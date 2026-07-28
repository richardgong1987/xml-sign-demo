# SAML SSO Demo: how an IdP and an SP cooperate

Two Express services in one process, playing both sides of a SAML 2.0 single sign-on
so you can watch the handshake happen in a browser.

| | Command |
| --- | --- |
| Run the demo | `npm start` |
| Run the tests | `npm test` |

## Requirements

- Node.js 24 or newer
- npm

The code is written as ES Modules (`"type": "module"` in `package.json`, so every
`.js` file is an ES module). It uses `import.meta.dirname`, `node:util`'s `styleText`
and `parseArgs`, `AbortSignal.timeout()`, and `RegExp.escape()` — hence the Node 24
floor.

## Running it

```bash
npm install
npm start
```

Then open <http://localhost:5000> and click "Sign in through Demo OpenAM".

Two independent services start in the same process:

- **Demo OpenAM (IdP)** — `http://localhost:4000`
- **JSL-online (SP)** — `http://localhost:5000`

Both ports can be overridden:

```bash
npm start -- --idp-port 4001 --sp-port 5001
```

### Endpoints

| Service | Endpoint | Purpose |
| --- | --- | --- |
| IdP | `GET /idp/metadata` | publishes entity ID, SSO URL, and signing certificate |
| IdP | `GET /idp/sso` | receives the AuthnRequest, shows the login page |
| IdP | `POST /idp/login` | signs a SAMLResponse and auto-POSTs it back to the SP |
| SP | `GET /login` | builds an AuthnRequest and redirects to the IdP |
| SP | `GET /api/saml/metadata` | SP metadata, to be registered with the IdP |
| SP | `POST /api/saml/acs` | validates the SAMLResponse and opens a session |
| SP | `GET /profile` | shows the signed-in user |

### The full flow

```text
Browser           SP (:5000)                      IdP (:4000)
  |  GET /login       |                                |
  |------------------>| builds the AuthnRequest        |
  |<-- 302 -----------|                                |
  |  GET /idp/sso?SAMLRequest=..&RelayState=..         |
  |--------------------------------------------------->| parses the AuthnRequest
  |<-------------------------- login page (pick a user)-|
  |  POST /idp/login  |                                |
  |--------------------------------------------------->| xml-crypto signs the assertion
  |<-------------------------- self-submitting form ----|
  |  POST /api/saml/acs                                |
  |------------------>| node-saml -> xml-crypto verify |
  |                   | checks Audience/Recipient/time |
  |<-- 302 /profile --| Set-Cookie                     |
```

How trust is established: at startup the SP fetches `GET /idp/metadata` and imports the
IdP's signing certificate as node-saml's `idpCert`. **The SP never touches the IdP
private key.**

### Tampering

The IdP login page has a "simulate a man-in-the-middle" checkbox. With it ticked, the
IdP rewrites `role` to `administrator` *after* signing, then hands the result to the
browser to POST. The SP's ACS answers `Invalid signature` and opens no session.

## Tests

```bash
npm test           # all 38 cases
npm run test:unit  # models and services, 27 cases, no HTTP or keys needed
npm run test:e2e   # end to end, 11 cases, boots both services for real
```

Everything runs on Node's built-in `node:test` — no test framework dependency.

The end-to-end suite reuses `src/bootstrap.js` to start the services and drives them
with a cookie-keeping `fetch` acting as a browser, asserting each hop. It also covers
two rejection paths: man-in-the-middle tampering (`Invalid signature`) and replaying
the same SAMLResponse (`InResponseTo is not valid`). It listens on ports 14000/15000,
so it can run while `npm start` is up.

## What the two libraries do

### `xml-crypto`

Low-level XML digital signatures: canonicalization, digests, RSA signing and
verification — plus `getSignedReferences()`, which returns the only XML the signature
actually covers.

### `@node-saml/node-saml`

The SAML protocol proper: building the AuthnRequest, base64-decoding the SAMLResponse,
calling `xml-crypto` internally to verify, then checking Audience, Recipient,
InResponseTo, and NotBefore / NotOnOrAfter before returning a user profile.

In one sentence: **`xml-crypto` proves this XML was not modified; `node-saml` proves
this login result is meant for us, is valid right now, and came from the IdP we trust.**

## Layout

IdP and SP are two independent projects that never import each other — they cooperate
over HTTP alone. Inside each, files are grouped by technical layer.

```text
docs/design/saml-sso-http.md  design doc: boundaries, dependency direction, test strategy
src/config.js                 derives every entity ID and URL from the two ports
src/bootstrap.js              composition root: start the IdP, then let the SP import its metadata
src/server.js                 CLI entry point; prints the banner

src/identity-provider/        Demo OpenAM
├── models/                   user directory, SP registry, SAMLResponse and metadata factories
├── services/                 issuing use case, xml-crypto signer, AuthnRequest parser
├── controllers/              idp.controller.js
├── presenters/               idp.presenter.js
├── views/                    login.ejs, auto-post.ejs
└── app.js                    this project's wiring point

src/service-provider/         JSL-online
├── models/                   authenticated-user.js
├── services/                 start/complete SSO use cases, node-saml, sessions, metadata client
├── controllers/              sp.controller.js
├── presenters/               sp.presenter.js
├── views/                    home.ejs, profile.ejs
└── app.js                    this project's wiring point

src/shared/                   what both projects share
├── utils/                    clock, SAML ID, X.509, template engine, error handling
├── views/                    common layout: _head.ejs, _foot.ejs
└── public/demo.css           stylesheet

tests/identity-provider/      mirrors src
tests/service-provider/
tests/e2e/                    end-to-end suite
```

Inside a project, which layer a file belongs to is decided by *what makes it change*:

| Directory | Reason to change |
| --- | --- |
| `models/` | a business rule changed |
| `services/` | a workflow changed, or an external library or store was swapped |
| `controllers/` | the wire protocol changed |
| `presenters/`, `views/` | the page output changed |
| `app.js` | an implementation was swapped (in-memory sessions for Redis, say) |

No HTML or CSS lives in JavaScript. Markup sits in each project's `views/*.ejs`, a
presenter only picks a template and prepares its data (`{ view, model }`), and the
controller renders through `shared/utils/render-view.js`. Every page opens with
`include("_head", { title })` and closes with `include("_foot")`.

## How production differs

- The IdP private key and certificate come from a corporate PKI and are long-lived;
  this demo mints a throwaway pair on every start.
- The AuthnRequest context belongs in the IdP's own session; this demo passes it in
  hidden form fields.
- Sessions belong in Redis or a database; this demo keeps them in an in-process Map.
- `tampering.simulator.js` is an attack simulation for teaching purposes and has no
  place in production code.
