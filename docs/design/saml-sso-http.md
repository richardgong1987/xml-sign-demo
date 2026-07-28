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
- SP: `The SP validates the SAMLResponse the IdP issued and opens a local session for the user it describes.`

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
| `CompleteSingleSignOnUseCase` | `{ sessionId, returnTo }` |

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
- Only a validated user gets a session.

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
  |                   |   '- open a session, Set-Cookie
  |<-- 302 /profile --|                                |
```

Establishing trust: while its module initialises the SP fetches `GET /idp/metadata` and
reads the IdP's entity ID, SSO URL, and signing certificate from it, using the
certificate as node-saml's `idpCert`. The SP never touches the IdP private key.

Because that fetch is an async provider, the SP cannot start before the IdP is
reachable; doing so exits with `Cannot read the IdP metadata: ... is unreachable`. A
production SP would retry, or load the metadata from a file deployed alongside it.

## 7. Architecture Boundary

The first boundary is "two independent applications"; technical layering comes second.
Each is deployable on its own — its own `main.ts`, its own config module, its own
command line — and neither imports anything from the other. They cooperate over HTTP
alone.

```text
src/identity-provider/          src/service-provider/
├── main.ts (--port, --sp-url)  ├── main.ts (--port, --idp-url)
├── *.config.ts                 ├── *.config.ts
├── models/                     ├── models/
│   user-directory              │   authenticated-user
│   service-provider-registry   │
│   saml-response.factory       │
│   idp-metadata.factory        │
├── services/                   ├── services/
│   issue-saml-response (UC)    │   start-single-sign-on (UC)
│   xml-crypto-assertion-signer │   complete-single-sign-on (UC)
│   authn-request.parser        │   node-saml.gateway
│   signing-credential          │   in-memory-session-store
│   tampering.simulator         │   idp-metadata.client
├── controllers/                ├── controllers/
├── presenters/                 ├── presenters/
├── views/                      ├── views/
└── *.module.ts (bindings)      └── *.module.ts (bindings)

src/shared/     Clock port, exception filter, view layer, X.509, createWebApplication
```

Configuration is split along the same seam. The IdP is told which service providers it
may issue assertions for (`--sp-url`, registration data an administrator would supply);
the SP is told where to fetch trust (`--idp-url`). Neither has a flag for the other's
port, because neither owns it.

Nothing in `src/` starts both applications. The end-to-end suite needs them together,
so that orchestration lives in `test/start-both-applications.ts` and nowhere else.

Ports are abstract classes (`Clock`, `AssertionSigner`, `SamlGateway`, `SessionStore`).
They survive compilation, so they double as injection tokens, and a use case can depend
on the abstraction while only the module names an implementation. Values that have no
class to hang off — configuration objects, the metadata string — use symbol tokens,
because a TypeScript interface does not exist at runtime.

Within an application, which layer a file belongs to depends on what makes it change:
a business rule goes to `models/`, a workflow or an external library to `services/`,
the wire protocol to `controllers/`, page output to `presenters/` and `views/`, and
swapping an implementation to the module.

### Views

No HTML lives in TypeScript. The responsibility splits three ways:

```text
<app>/presenters/   turns a use-case result into exactly the data one template needs
<app>/views/        that application's page templates; EJS's <%= %> does the escaping
shared/views/       common layout: _head.ejs and _foot.ejs
shared/public/      stylesheet, mounted at the root of both applications
```

A controller names its template with `@Render("login")` and returns the model, so no
controller ever touches the view engine. `shared/web-layer.ts` sets each application's
view directories to `[the application's own views, shared/views]`: pages resolve inside
the application, and `include("_head")` falls back to the common layout. Note that
Express never forwards its views setting to the template engine, so the same list must
also be written to `app.locals.views` for EJS to see it when resolving includes.

## 8. Dependencies

```text
controller -> use case -> model
controller -> presenter
use case   -> port (AssertionSignerPort / ClockPort / SamlGatewayPort / SessionStorePort)
adapter    -> port implementation
```

Files under `models/` and the use cases under `services/` import no `express`, no
`xml-crypto`, and no `@node-saml/node-saml`. Those libraries appear only in the
adapter files under `services/`, in `controllers/`, and in the module files.

## 9. External Details

- `@nestjs/core` / `@nestjs/platform-express` / `cookie-parser`: HTTP transport and DI.
- `ejs`: page templates.
- `xml-crypto`: XML canonicalization, digests, RSA signing and verification.
- `@node-saml/node-saml`: AuthnRequest generation, SAMLResponse validation, SP metadata.
- `selfsigned`: mints the IdP's self-signed X.509 certificate at startup.
- Session storage: an in-process Map.
- Runtime: Node.js >= 24, ES Modules (`"type": "module"`), `import.meta.dirname` for
  path resolution.

## 10. Test Strategy

`npm test` runs both layers in one go: 54 cases on Jest with `ts-jest`.

Unit specs sit next to the code they cover (`src/**/*.spec.ts`) and need no HTTP, keys,
or database. Those covering a Nest provider build their subject with
`Test.createTestingModule`, binding fakes to the very same ports the production module
binds real implementations to:

- `saml-response.factory`: validity window under a fixed `issuedAt`, Audience,
  Destination, `InResponseTo` echoing, attribute mapping.
- `user-directory` / `service-provider-registry`: unknown entries raise domain errors,
  and the `Map` behind the directory keeps prototype members out.
- `authn-request.parser`: namespace-prefix independence, whitespace around a
  pretty-printed Issuer, and every rejection path (missing parameter, non-deflate
  payload with the zlib failure kept as `cause`, non-XML payload, missing ID or Issuer,
  a well-formed message that is not an AuthnRequest).
- `authenticated-user`: refuses creation without a NameID, immutable afterwards.
- `IssueSamlResponseUseCase`: with a fake `AssertionSigner` and a fixed `Clock`,
  asserts the delivery address comes from the registry, the time comes from the
  injected clock, and invalid input never reaches the signing step.
- `CompleteSingleSignOnUseCase`: with a fake `SamlGateway` and `SessionStore`, asserts
  the RelayState off-site fallback and that a failed validation opens no session.

End to end (`test/single-sign-on.e2e-spec.ts`) calls `startSamlDemo()` to boot both Nest
applications for real and drives them with a cookie-keeping `fetch` acting as a browser,
asserting each hop: metadata exchange, AuthnRequest generation and parsing, issuing and
delivery, session creation, RelayState redirect, sign-out, plus three rejection paths
(man-in-the-middle tampering -> `Invalid signature`; replay -> `InResponseTo is not
valid`; malformed AuthnRequest -> 400).

The end-to-end suite listens on ports 14000/15000, so it can run while `npm start` is up.

One Jest caveat worth knowing: its `node` environment isolates realms, so an error
raised inside a Node core module is not `instanceof Error` in a spec. Assertions about a
preserved `cause` check its shape rather than its constructor.

## 11. Risks and Trade-offs

- The IdP carries AuthnRequest context between `/idp/sso` and `/idp/login` in hidden
  form fields. Production should keep it in the IdP's own session so the user cannot
  rewrite it.
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
- NestJS adds a build step and a sizeable dependency tree to what was a
  dependency-light demo. The trade is that the DI container now enforces the wiring
  rules the architecture describes — a use case cannot reach an implementation it was
  not given — and the trust import became an async provider rather than hand-ordered
  startup code.
