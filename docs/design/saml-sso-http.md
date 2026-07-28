# SAML SSO over HTTP Design

## 1. Business Purpose

Signature creation and verification can be demonstrated with direct method calls in a
single process, and that does show how `xml-crypto` and `@node-saml/node-saml` divide
the work. What it cannot show is the actual collaboration between an IdP and an SP:
who starts the exchange, how the browser relays it, and where trust comes from.

This design places the same knowledge in two independent HTTP services so an engineer
can watch a complete SP-initiated single sign-on happen in a browser.

## 2. Use Case

- IdP: `Once a user has authenticated, the IdP issues a signed SAMLResponse for the requesting SP.`
- SP: `The SP validates the SAMLResponse the IdP issued and mints its own access token for the user it describes.`

## 3. Input Model

| Use case | Input |
| --- | --- |
| `IssueSamlResponseUseCase` | `{ uid, serviceProviderEntityId, authnRequestId }` |
| `StartSingleSignOnUseCase` | `{ returnTo }` |
| `CompleteSingleSignOnUseCase` | `{ samlResponse, relayState }` |

External input (`req.query`, `req.body`, base64, deflate) is translated into these
models at the adapter layer and never reaches a use case unchanged.

## 4. Output Model

| Use case | Output |
| --- | --- |
| `IssueSamlResponseUseCase` | `{ assertionConsumerServiceUrl, samlResponse }` |
| `StartSingleSignOnUseCase` | the IdP sign-in URL (string) |
| `CompleteSingleSignOnUseCase` | `{ accessToken, returnTo }` |

## 5. Domain Rules

IdP side:

- Assertions are issued only for registered service providers, and the ACS URL comes
  from the IdP's own registry rather than from the request.
- The assertion's Audience must be the target SP's entity ID.
- The assertion carries an explicit validity window that allows for the agreed clock skew.
- The assertion must carry `InResponseTo`, matching the AuthnRequest the SP sent.

SP side:

- Only assertions signed by the configured IdP certificate are accepted.
- RelayState must be a local path; anything else falls back to the default landing
  page (open-redirect protection).
- Only a validated user gets an access token, and that token is the whole sign-in: a
  valid signature and a live expiry mean signed in, anything else means not signed in.

## 6. Application Flow

```text
Browser           SP (:3000)                      IdP (:4000)
  |  GET /login       |                                |
  |------------------>| StartSingleSignOnUseCase       |
  |<-- 302 -----------| builds AuthnRequest (deflate+base64)
  |  GET /idp/sso?SAMLRequest=..&RelayState=..         |
  |--------------------------------------------------->| parses the AuthnRequest
  |<-------------------------- login page (pick a user)-|
  |  POST /idp/login  |                                |
  |--------------------------------------------------->| IssueSamlResponseUseCase
  |                   |                                |   |- look up the ACS in the registry
  |                   |                                |   |- build the SAMLResponse
  |                   |                                |   '- xml-crypto signs the assertion
  |<-------------------------- self-submitting form ----|
  |  POST /api/saml/acs                                |
  |------------------>| CompleteSingleSignOnUseCase    |
  |                   |   |- node-saml -> xml-crypto verify
  |                   |   |- check Audience/Recipient/validity/InResponseTo
  |                   |   '- sign the SP's own JWT
  |<-- hand-off page -| script stores it in localStorage
  |  GET /api/me  Authorization: Bearer <jwt>          |
  |------------------>| BearerTokenGuard verifies it   |
```

Establishing trust: while its module initialises the SP fetches `GET /idp/metadata` and
reads the IdP's entity ID, SSO URL, and signing certificate from it, using the
certificate as node-saml's `idpCert`. The SP never touches the IdP private key.

Because that fetch is an async provider, the SP cannot start before the IdP is
reachable; doing so exits with `Cannot read the IdP metadata: ... is unreachable`. A
production SP would retry, or load the metadata from a file deployed alongside it.

## 7. Architecture Boundary

The first boundary is "two independently deployable applications"; technical layering
comes second. Each is its own npm workspace with its own dependencies, build and entry
point, and neither imports anything from the other. They cooperate over HTTP alone.

They deliberately run on different stacks — the IdP on NestJS, the SP on Next.js —
because SAML is an interoperability protocol. If the demo were built twice on the same
framework it would be easy to mistake a shared convention for part of the protocol.

```text
apps/identity-provider/ (NestJS)     apps/service-provider/ (Next.js)
├── src/main.ts (--port, --sp-url)   ├── app/                 pages + route handlers
├── src/identity-provider.config.ts  ├── src/config/          env-driven configuration
├── src/models/                      ├── src/domain/
│   user-directory                   │   authenticated-user
│   service-provider-registry        ├── src/services/
│   saml-response.factory            │   start-single-sign-on (UC)
│   idp-metadata.factory             │   complete-single-sign-on (UC)
├── src/services/                    │   node-saml.gateway
│   issue-saml-response (UC)         │   jose-access-token.issuer
│   xml-crypto-assertion-signer      │   idp-metadata.client
│   authn-request.parser             ├── src/presenters/
│   signing-credential               ├── src/token-handoff.page.ts
│   tampering.simulator              └── src/service-provider.runtime.ts
├── src/controllers/ presenters/ views/
├── src/shared/                          e2e/  builds and runs both, drives with fetch
└── src/identity-provider.module.ts
```

Configuration is split along the same seam. The IdP is told which service providers it
may issue assertions for (`--sp-url`, registration data an administrator would supply);
the SP is told where to fetch trust (`IDP_BASE_URL`). Neither has a knob for the other's
port, because neither owns it.

Nothing in either application starts both. The end-to-end suite needs them together, so
that orchestration lives in `e2e/run-applications.ts` and nowhere else.

### The same architecture on two frameworks

The SP's `src/` moved over from the NestJS version almost unchanged. That is the whole
point of keeping use cases free of framework imports — and it is also the clearest
evidence that the boundaries are real rather than decorative. What had to change was
only the outermost layer:

| | NestJS | Next.js |
| --- | --- | --- |
| Wiring | DI container, `*.module.ts` | one memoised factory |
| Ports | abstract classes (need a runtime token) | plain interfaces |
| Routing | `@Controller` + `@Get` | `app/**/route.ts` |
| Views | EJS + presenters | React server and client components |
| JWT | `@nestjs/jwt` | `jose` |
| Configuration | `parseArgs` flags | environment variables |
| Auth check | `CanActivate` guard | a function each handler calls |
| Trust import | async provider, resolved at boot | memoised promise, resolved on first use |

Two consequences worth knowing about:

- Nest could enforce "this use case may only see ports" through the container. Next
  cannot, so the same rule is now a convention: `src/` imports nothing from `next`, and
  `app/` holds no business logic.
- A Next route handler may not import `react-dom/server`, so the hand-off document is
  built as a string in `token-handoff.page.ts` with its own escaping, rather than as a
  React component.

Within an application, which layer a file belongs to depends on what makes it change:
a business rule goes to `models/` or `domain/`, a workflow or an external library to
`services/`, the wire protocol to `controllers/` or `app/**/route.ts`, page output to
`presenters/` and the templates, and swapping an implementation to the module or the
runtime factory.

## 8. Dependencies

```text
controller -> use case -> model
controller -> presenter
use case   -> port (AssertionSigner / Clock / SamlGateway / AccessTokenIssuer)
adapter    -> port implementation
```

Files under `models/` and the use cases under `services/` import no `express`, no
`xml-crypto`, and no `@node-saml/node-saml`. Those libraries appear only in the
adapter files under `services/`, in `controllers/`, and in the module files.

## 9. External Details

- `@nestjs/core` / `@nestjs/platform-express`: HTTP transport and DI, IdP side.
- `ejs`: page templates, IdP side.
- `next` / `react`: HTTP transport and pages, SP side.
- `jose`: signs and verifies the SP's own access tokens (HS256).
- `xml-crypto`: XML canonicalization, digests, RSA signing and verification.
- `@node-saml/node-saml`: AuthnRequest generation, SAMLResponse validation, SP metadata.
- `selfsigned`: mints the IdP's self-signed X.509 certificate at startup.
- Sign-in state: none on the server; the browser holds a JWT in localStorage.
- Runtime: Node.js >= 24, ES Modules (`"type": "module"`), `import.meta.dirname` for
  path resolution.

## 10. Test Strategy

`npm test` runs both layers: 47 unit cases across the two workspaces, then 16
end-to-end.

Unit specs sit next to the code they cover and need no HTTP, keys, or database.
The IdP is a Nest application, so specs that exercise a provider build it with
`Test.createTestingModule`, binding fakes to the same tokens the production module binds
real implementations to. The SP has no container, so a fake is an object literal and the
subject is constructed directly — the same test, one indirection lighter.

- `saml-response.factory`: validity window under a fixed `issuedAt`, Audience,
  Destination, `InResponseTo` echoing, attribute mapping.
- `user-directory` / `service-provider-registry`: unknown entries raise domain errors,
  and the `Map` behind the directory keeps prototype members out.
- `authn-request.parser`: namespace-prefix independence, whitespace around a
  pretty-printed Issuer, and every rejection path.
- `authenticated-user`: refuses creation without a NameID, immutable afterwards.
- `IssueSamlResponseUseCase`: with a fake `AssertionSigner` and a fixed `Clock`, asserts
  the delivery address comes from the registry and invalid input never reaches signing.
- `CompleteSingleSignOnUseCase`: with a fake `SamlGateway` and `AccessTokenIssuer`,
  asserts the RelayState off-site fallback and that a failed validation mints no token.
- `createJoseAccessTokenIssuer`: round-trips the identity, and refuses a token signed
  with a different secret, edited after signing, or past its expiry.

End to end (`e2e/`) is the only package that runs both applications. Its `globalSetup`
builds each workspace, spawns `node apps/identity-provider/dist/main.js` and
`next start`, waits for both to answer, and the specs drive them with `fetch`: metadata
exchange, AuthnRequest generation and parsing, issuing and delivery, token hand-off,
`/api/me` with and without a valid bearer token, plus four rejection paths
(tampering, replay, malformed AuthnRequest, edited JWT payload).

It listens on 14000/15000, so it can run while a development server is up, and it uses
a fixed `SP_ACCESS_TOKEN_SECRET` so a token minted in one spec is still verifiable in
the next.

Two things it does not cover:

- That the hand-off script actually runs and writes localStorage. Verifying that needs a
  real browser; Playwright would be the next step.
- Jest's `node` environment isolates realms, so an error raised inside a Node core
  module is not `instanceof Error` in a spec. Assertions about a preserved `cause` check
  its shape rather than its constructor.

## 11. Risks and Trade-offs

- The IdP carries AuthnRequest context between `/idp/sso` and `/idp/login` in hidden
  form fields. Production should keep it in the IdP's own session so the user cannot
  rewrite it.
- Keeping the token in localStorage means any XSS on the SP can read it, and nothing can
  revoke it before `exp` — signing out only clears the browser's copy. An end-to-end
  test asserts that a captured token still works after sign-out, so the property stays
  visible rather than forgotten. An `httpOnly`, `SameSite` cookie is stronger; the usual
  production answer is short-lived tokens plus refresh, or a server-side session.
- The JWT secret is minted on every start, so a restart invalidates every token still in
  a browser. Production reads a stable secret from a secret manager.
- The IdP private key and certificate are regenerated on every start, so assertions
  issued before a restart stop verifying. Production uses PKI-issued, long-lived material.
- Sessions live in memory: lost on restart, and not deployable across instances.
- `tampering.simulator.ts` is an attack simulation standing in for a browser or network
  man-in-the-middle. It is not IdP business logic and has no place in production code.
- `SamlFailureFilter` turns every non-HttpException into a 400 carrying the rejection
  reason. That is deliberate for a demo meant to be read; a production SP would answer
  with a generic page and keep the detail in the log.
- SAML IDs are generated with `randomUUID()` inside the model layer. Time is injected
  through the `Clock` port for testability, but random IDs affect no assertion, so no
  additional port was introduced for them.
- The SP has a hard startup dependency on the IdP being reachable. That makes the trust
  import visible, which is the teaching goal, but it is not how a production SP should
  behave: it should retry, cache, or read metadata from disk.
- Running two frameworks doubles the dependency tree and the amount of build tooling a
  reader has to understand. The trade is that the boundary between "our architecture"
  and "what the framework wants" becomes impossible to miss: the same use cases run
  unchanged under a DI container and under a plain factory.
- On the Next side nothing enforces the dependency rule any more. Nest could refuse to
  inject what a use case was not given; here `src/` importing from `next` would simply
  compile. The rule survives as a convention and a review habit.
- The SP no longer fails fast when the IdP is unreachable — it starts and fails on the
  first SSO request instead, because Next offers no dependable boot hook. Production
  would retry, cache, or read metadata from disk.
