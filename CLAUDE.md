# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install        # install dependencies
npm test           # everything (38 cases) — the verification loop
npm run test:unit  # models + services only (27), no HTTP/keys needed
npm run test:e2e   # end-to-end only (11), boots real servers on :14000/:15000
npm start          # IdP on :4000 + SP on :5000 (override with -- --idp-port / --sp-port)
```

Tests use Node's built-in `node:test` — no test framework dependency. Run a single file with `node --test tests/identity-provider/models/saml-response.factory.test.js`, or a single case with `--test-name-pattern`. There is no linter or build step.

E2E tests call `startSamlDemo()` from `src/bootstrap.js` directly, so they exercise real wiring, and they use their own ports — `npm start` can stay running while they execute.

Note: `package-lock.json` is out of sync with `package.json`, so `npm ci` fails. Use `npm install`.

## What this repository is

A teaching demo of SAML 2.0 SSO. Two Express apps run in one process on separate ports, playing **Demo OpenAM (IdP, :4000)** and **JSL-online (SP, :5000)**, showing how the two sides actually cooperate through the browser.

The design doc is `docs/design/saml-sso-http.md` — read it before changing boundaries; it records the dependency direction and the reasoning behind each trade-off.

## Architecture (src/)

**Two independent projects first, technical layers second.** `src/identity-provider/` and `src/service-provider/` never import each other — they cooperate over HTTP only. That is the primary boundary; preserve it.

```
src/config.js               createSamlConfigs(ports) derives every entity ID and URL
src/bootstrap.js            starts both projects, wires the trust import
src/server.js               CLI entry point; prints the banner

src/identity-provider/      Demo OpenAM
  models/                   user-directory, service-provider-registry,
                            saml-response.factory, idp-metadata.factory
  services/                 issue-saml-response (use case), xml-crypto signer,
                            authn-request.parser, tampering.simulator
  controllers/ presenters/ views/
  app.js                    this project's wiring point

src/service-provider/       JSL-online
  models/                   authenticated-user
  services/                 start/complete-single-sign-on (use cases),
                            node-saml.gateway, session store, idp-metadata.client
  controllers/ presenters/ views/
  app.js                    this project's wiring point

src/shared/utils/           clock, SAML id, X.509 PEM, render-view, view-engine
src/shared/views/           _head.ejs / _foot.ejs
src/shared/public/          demo.css
```

Inside a project, where a file goes is decided by *what makes it change*: business rule → `models/`, workflow or external library → `services/`, wire protocol → `controllers/`, page output → `presenters/` + `views/`, swapping an implementation → `app.js`.

Rules that hold across the codebase:

- ES Modules (`"type": "module"`), Node >= 24. Relative imports carry the `.js` extension; `import.meta.dirname` replaces `__dirname`. Modern built-ins are preferred over dependencies: `node:util`'s `styleText` (no chalk) and `parseArgs`, `AbortSignal.timeout()`, `RegExp.escape()`, `Error` `cause` chains, top-level await instead of a `main()` wrapper.
- No HTML or CSS in JavaScript. Markup lives in each project's `views/*.ejs`; presenters return `{ view, model }` and nothing else; controllers render through `shared/utils/render-view.js`, so neither layer imports EJS. Escaping is EJS's `<%= %>` — don't hand-roll it. Every page opens with `include("_head", { title })` and closes with `include("_foot")`.
- `shared/utils/view-engine.js` sets each app's views to `[ownViews, sharedViews]`. It also mirrors that list into `app.locals.views` — Express does not forward its views setting to the template engine, and EJS resolves `include()` from `options.views`. Removing that line silently breaks every `include("_head")`.
- `models/` and the use-case files in `services/` import no `express`, no `xml-crypto`, no `@node-saml/node-saml`. Those libraries appear only in the adapter files under `services/` (`*.gateway.js`, `*-signer.js`, `*.client.js`, `*.parser.js`), in `controllers/`, and in `app.js`. Ports are declared as JSDoc `@typedef` at the top of the use case that needs them.
- Each project's `app.js` is the only file that swaps a port for a concrete implementation.
- `startSamlDemo()` starts the IdP first, then the SP fetches `GET /idp/metadata` to import the IdP's signing certificate. That order is the trust-establishment order and is the point of the demo; don't collapse it into a shared module.
- Ports are a parameter, not a constant: every entity ID and URL is derived from them in `createSamlConfigs()`. That is what lets the e2e suite run a second, isolated pair of servers.

Two boundaries that carry security meaning, not just structure:

- `identity-provider/models/service-provider-registry.js` decides the ACS URL from the IdP's own registry, never from the AuthnRequest. Trusting the request's `AssertionConsumerServiceURL` would let an attacker redirect a valid assertion.
- `toSafeLandingPage()` in `service-provider/services/complete-single-sign-on.js` restricts RelayState to local paths.

`tampering.simulator.js` is demo-only, representing a man-in-the-middle between IdP and SP. It is deliberately not IdP business logic.

## The lesson the code is built to demonstrate

`xml-crypto` proves *the bytes were not modified*. `@node-saml/node-saml` proves *this login result is for us, right now, from the expected IdP*. Only `getSignedReferences()` returns XML the signature actually covers — never trust the surrounding document.

## Conventions

- Comments, docs, test names, and user-facing output are in English. Match that.
- XPath uses `local-name(.)` rather than namespace prefixes, since SAML documents vary in prefix choice.
- Comments explain *why* — a business rule, a security consequence, or a production-vs-demo difference. This repo exists to be read, so those comments are the deliverable; redundant step-by-step narration is not.
