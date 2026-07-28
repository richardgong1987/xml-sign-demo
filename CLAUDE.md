# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install        # install dependencies
npm test           # everything (38 cases) — the verification loop
npm run test:unit  # domain + use case only (27), no HTTP/keys needed
npm run test:e2e   # end-to-end only (11), boots real servers on :14000/:15000
npm start          # HTTP demo: IdP on :4000 + SP on :5000
npm run demo       # offline demo: single process, direct method calls (demo.js)
```

Tests use Node's built-in `node:test` — no test framework dependency. Run a single file with `node --test tests/features/identity-provider/saml-response.factory.test.js`, or a single case with `--test-name-pattern`. There is no linter or build step.

E2E tests call `startSamlDemo()` from `src/bootstrap.js` directly, so they exercise real wiring, and they use their own ports — `npm start` can stay running while they execute.

Note: `package-lock.json` is out of sync with `package.json`, so `npm ci` fails. Use `npm install`.

## What this repository is

A teaching demo of SAML 2.0 SSO, in two forms:

- **`src/`** — the HTTP version. Two Express apps in one process, on separate ports, playing **Demo OpenAM (IdP, :4000)** and **JSL-online (SP, :5000)**. Shows how the two sides actually cooperate over the browser.
- **`demo.js`** — the original offline version. No HTTP, direct method calls, focused only on sign/verify. Kept because it isolates the crypto from the protocol plumbing. It is standalone and does not share code with `src/`.

The design doc is `docs/design/saml-sso-http.md` — read it before changing boundaries; it records the dependency direction and the reasoning behind each trade-off.

## Architecture (src/)

Grouped by technical layer, dependencies pointing inward. **IdP and SP files share every directory** — which side a file belongs to is carried by its name prefix (`idp.` / `sp.`) and its header comment, not by its location. Keep that naming; it is the only boundary marker left.

```
src/config.js      createSamlConfigs(ports) derives every entity ID and URL from ports
src/bootstrap.js   composition root — startSamlDemo(ports) + both app factories
src/server.js      CLI entry point; prints the banner
src/models/        business rules: user-directory, service-provider-registry,
                   saml-response.factory, idp-metadata.factory, authenticated-user
src/services/      use cases (issue-saml-response, start/complete-single-sign-on)
                   + external adapters (xml-crypto signer, node-saml gateway,
                   session store, metadata client, authn-request parser)
src/controllers/   idp.controller / sp.controller — Express routers
src/presenters/    view models: { view, model }
src/views/         all EJS templates + _head.ejs / _foot.ejs
src/public/        demo.css — served statically by both apps
src/utils/         clock, SAML id, X.509 PEM, render-view, view-engine, error handler
```

Where a file goes is decided by *what makes it change*: business rule → `models/`, workflow or external library → `services/`, wire protocol → `controllers/`, page output → `presenters/` + `views/`.

Rules that hold across the codebase:

- No HTML or CSS in JavaScript. Markup lives in `src/views/*.ejs`; presenters return `{ view, model }` and nothing else; controllers render through `utils/render-view.js`, so neither layer imports EJS. Escaping is EJS's `<%= %>` — don't hand-roll it. Every page opens with `include("_head", { title })` and closes with `include("_foot")`.
- `models/` and the use-case files in `services/` import no `express`, no `xml-crypto`, no `@node-saml/node-saml`. Those libraries appear only in the adapter files under `services/` (`*.gateway.js`, `*-signer.js`, `*-store.js`, `*.client.js`, `*.parser.js`), in `controllers/`, and in `bootstrap.js`. Ports are declared as JSDoc `@typedef` at the top of the use case that needs them.
- `bootstrap.js` is the only file that swaps a port for a concrete implementation.
- `startSamlDemo()` starts the IdP first, then the SP fetches `GET /idp/metadata` to import the IdP's signing certificate. That order is the trust-establishment order and is the point of the demo; don't collapse it into a shared module.
- Ports are a parameter, not a constant: every entity ID and URL is derived from them in `createSamlConfigs()`. That is what lets the e2e suite run a second, isolated pair of servers.

Two boundaries that carry security meaning, not just structure:

- `models/service-provider-registry.js` (IdP) decides the ACS URL from the IdP's own registry, never from the AuthnRequest. Trusting the request's `AssertionConsumerServiceURL` would let an attacker redirect a valid assertion.
- `toSafeLandingPage()` in `services/complete-single-sign-on.js` restricts RelayState to local paths.

`tampering.simulator.js` is demo-only, representing a man-in-the-middle between IdP and SP. It is deliberately not IdP business logic.

## The lesson the code is built to demonstrate

`xml-crypto` proves *the bytes were not modified*. `@node-saml/node-saml` proves *this login result is for us, right now, from the expected IdP*. Only `getSignedReferences()` returns XML the signature actually covers — never trust the surrounding document.

## Conventions

- Comments, docs, and user-facing output are in Chinese. Match that.
- CommonJS (`require`), Node >= 18.
- XPath uses `local-name(.)` rather than namespace prefixes, since SAML documents vary in prefix choice.
- Comments explain *why* — a business rule, a security consequence, or a production-vs-demo difference. This repo exists to be read, so those comments are the deliverable; redundant step-by-step narration is not.
