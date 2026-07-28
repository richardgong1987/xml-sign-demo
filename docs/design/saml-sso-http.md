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
Browser           SP (:5000)                      IdP (:4000)
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

Establishing trust: at startup the SP fetches `GET /idp/metadata` and reads the IdP's
entity ID, SSO URL, and signing certificate from it, using the certificate as
node-saml's `idpCert`. The SP never touches the IdP private key.

## 7. Architecture Boundary

The first boundary is "two independent projects"; technical layering comes second.
IdP and SP each own a directory, cooperate over HTTP alone, and import nothing from
each other.

```text
src/identity-provider/          src/service-provider/
├── models/                     ├── models/
│   user-directory              │   authenticated-user
│   service-provider-registry   │
│   saml-response.factory       │
│   idp-metadata.factory        │
├── services/                   ├── services/
│   issue-saml-response (UC)    │   start-single-sign-on (UC)
│   xml-crypto-assertion-signer │   complete-single-sign-on (UC)
│   authn-request.parser        │   node-saml.gateway
│   tampering.simulator         │   in-memory-session-store
│                               │   idp-metadata.client
├── controllers/                ├── controllers/
├── presenters/                 ├── presenters/
├── views/                      ├── views/
└── app.js (wiring point)       └── app.js (wiring point)

src/shared/utils/   clock, SAML ID, X.509, template engine, error handling
src/shared/views/   common layout
src/bootstrap.js    starts both projects and performs the trust import
```

Within a project, which layer a file belongs to depends on what makes it change:
a business rule goes to `models/`, a workflow or an external library to `services/`,
the wire protocol to `controllers/`, page output to `presenters/` and `views/`, and
swapping an implementation to `app.js`.

### Views

No HTML lives in JavaScript. The responsibility splits three ways:

```text
<project>/presenters/   picks the template and prepares its data, returns { view, model }
<project>/views/        that project's page templates; EJS's <%= %> does the escaping
shared/views/           common layout: _head.ejs and _foot.ejs
shared/public/          stylesheet, mounted at the root of both projects
```

Controllers call the template engine through `shared/utils/render-view.js`, so neither
controllers nor presenters know EJS exists. Swapping template engines touches only
`render-view.js`, `view-engine.js`, and the templates themselves.

`shared/utils/view-engine.js` sets each app's view directories to
`[the project's own views, shared/views]`: pages resolve inside the project, and
`include("_head")` falls back to the common layout. Note that Express never forwards
its views setting to the template engine, so the same list must also be written to
`app.locals.views` for EJS to see it when resolving includes.

Ports are declared as JSDoc `@typedef` at the top of the use case that needs them.
JavaScript has no interface keyword, and giving a one- or two-method port its own file
would only add navigation cost.

## 8. Dependencies

```text
controller -> use case -> model
controller -> presenter
use case   -> port (AssertionSignerPort / ClockPort / SamlGatewayPort / SessionStorePort)
adapter    -> port implementation
```

Files under `models/` and the use cases under `services/` import no `express`, no
`xml-crypto`, and no `@node-saml/node-saml`. Those libraries appear only in the
adapter files under `services/`, in `controllers/`, and in `app.js`.

## 9. External Details

- `express` / `cookie-parser`: HTTP transport.
- `ejs`: page templates.
- `xml-crypto`: XML canonicalization, digests, RSA signing and verification.
- `@node-saml/node-saml`: AuthnRequest generation, SAMLResponse validation, SP metadata.
- `selfsigned`: mints the IdP's self-signed X.509 certificate at startup.
- Session storage: an in-process Map.
- Runtime: Node.js >= 24, ES Modules (`"type": "module"`), `import.meta.dirname` for
  path resolution.

## 10. Test Strategy

`npm test` runs both layers in one go: 38 cases.

`tests/identity-provider/` and `tests/service-provider/` (27 cases) need no HTTP, keys,
or database:

- `saml-response.factory`: validity window under a fixed `issuedAt`, Audience,
  Destination, `InResponseTo` echoing, attribute mapping.
- `user-directory` / `service-provider-registry`: unknown entries raise domain errors,
  and the `Object.hasOwn` guard keeps prototype members out.
- `authenticated-user`: refuses creation without a NameID, immutable afterwards.
- `IssueSamlResponseUseCase`: with a fake `AssertionSignerPort` and a fixed `ClockPort`,
  asserts the delivery address comes from the registry, the time comes from the
  injected clock, and invalid input never reaches the signing step.
- `CompleteSingleSignOnUseCase`: with a fake `SamlGatewayPort` and `SessionStorePort`,
  asserts the RelayState off-site fallback and that a failed validation opens no session.

End to end (`tests/e2e/`, 11 cases) reuses `src/bootstrap.js` to start both services for
real and drives them with a cookie-keeping `fetch` acting as a browser, asserting each
hop: metadata exchange, AuthnRequest generation and parsing, issuing and delivery,
session creation, RelayState redirect, sign-out, plus two rejection paths
(man-in-the-middle tampering -> `Invalid signature`; replay -> `InResponseTo is not valid`).

The end-to-end suite listens on ports 14000/15000, so it can run while `npm start` is up.

`identity-provider/services/authn-request.parser` is currently covered only indirectly
by the end-to-end flow; unit tests for malformed SAMLRequests are not yet written.

## 11. Risks and Trade-offs

- The IdP carries AuthnRequest context between `/idp/sso` and `/idp/login` in hidden
  form fields. Production should keep it in the IdP's own session so the user cannot
  rewrite it.
- The IdP private key and certificate are regenerated on every start, so assertions
  issued before a restart stop verifying. Production uses PKI-issued, long-lived material.
- Sessions live in memory: lost on restart, and not deployable across instances.
- `tampering.simulator.js` is an attack simulation standing in for a browser or network
  man-in-the-middle. It is not IdP business logic and has no place in production code.
- SAML IDs are generated with `crypto.randomUUID()` inside the model layer. Time is
  injected through `ClockPort` for testability, but random IDs affect no assertion, so
  no additional port was introduced for them.
