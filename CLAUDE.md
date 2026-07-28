# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install     # install dependencies
npm start       # HTTP demo: IdP on :4000 + SP on :5000 (src/server.js)
npm run e2e     # end-to-end test — requires `npm start` already running
npm run demo    # offline demo: single process, direct method calls (demo.js)
```

There is no linter or build step. `npm run e2e` is the verification loop: it drives the full SP-initiated SSO flow with `fetch` and asserts both the happy path and the tampered-assertion rejection. Both entry points set `process.exitCode = 1` on failure.

Note: `package-lock.json` is out of sync with `package.json`, so `npm ci` fails. Use `npm install`.

## What this repository is

A teaching demo of SAML 2.0 SSO, in two forms:

- **`src/`** — the HTTP version. Two Express apps in one process, on separate ports, playing **Demo OpenAM (IdP, :4000)** and **JSL-online (SP, :5000)**. Shows how the two sides actually cooperate over the browser.
- **`demo.js`** — the original offline version. No HTTP, direct method calls, focused only on sign/verify. Kept because it isolates the crypto from the protocol plumbing. It is standalone and does not share code with `src/`.

The design doc is `docs/design/saml-sso-http.md` — read it before changing boundaries; it records the dependency direction and the reasoning behind each trade-off.

## Architecture (src/)

Feature-first, dependencies pointing inward. Both features are flat folders — the layer is in the filename suffix, not in nested directories.

```
src/config.js      entity IDs, URLs, lifetimes — the only place ports/hosts appear
src/server.js      composition root
src/shared/        clock, SAML id, X.509 PEM helpers, demo credential, render-view
src/shared/public/ demo.css — served statically by both apps
src/features/identity-provider/   *.factory (domain) → *.use-case → *.controller/*.presenter → views/*.ejs
src/features/service-provider/    authenticated-user (domain) → *.use-case → *.controller/*.presenter → views/*.ejs
```

Rules that hold across the codebase:

- No HTML or CSS in JavaScript. Markup lives in each feature's `views/*.ejs`; presenters return `{ view, model }` and nothing else; controllers render through `shared/render-view.js`, so neither layer imports EJS. Escaping is EJS's `<%= %>` — don't hand-roll it.
- `domain` and `use-case` files import no `express`, no `xml-crypto`, no `@node-saml/node-saml`. Ports are declared as JSDoc `@typedef` at the top of the use case that needs them; implementations live in `*.gateway.js`, `*-signer.js`, `*-store.js`, `*.client.js`.
- Each feature's `index.js` is its local wiring point — the only file that swaps a port for a concrete implementation.
- `src/server.js` starts the IdP first, then the SP fetches `GET /idp/metadata` to import the IdP's signing certificate. That order is the trust-establishment order and is the point of the demo; don't collapse it into a shared module.

Two boundaries that carry security meaning, not just structure:

- `service-provider-registry.js` (IdP) decides the ACS URL from the IdP's own registry, never from the AuthnRequest. Trusting the request's `AssertionConsumerServiceURL` would let an attacker redirect a valid assertion.
- `toSafeLandingPage()` in `complete-single-sign-on.use-case.js` restricts RelayState to local paths.

`tampering.simulator.js` is demo-only, representing a man-in-the-middle between IdP and SP. It is deliberately not IdP business logic.

## The lesson the code is built to demonstrate

`xml-crypto` proves *the bytes were not modified*. `@node-saml/node-saml` proves *this login result is for us, right now, from the expected IdP*. Only `getSignedReferences()` returns XML the signature actually covers — never trust the surrounding document.

## Conventions

- Comments, docs, and user-facing output are in Chinese. Match that.
- CommonJS (`require`), Node >= 18.
- XPath uses `local-name(.)` rather than namespace prefixes, since SAML documents vary in prefix choice.
- Comments explain *why* — a business rule, a security consequence, or a production-vs-demo difference. This repo exists to be read, so those comments are the deliverable; redundant step-by-step narration is not.
