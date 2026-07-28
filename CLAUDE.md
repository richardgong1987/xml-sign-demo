# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install        # install dependencies
npm test           # everything (54 cases) — the verification loop
npm run test:unit  # src/**/*.spec.ts only, no HTTP/keys needed
npm run test:e2e   # test/*.e2e-spec.ts only, boots real apps on :14000/:15000
npm start          # IdP on :4000 + SP on :3000 (override with -- --idp-port / --sp-port)
npm run build      # nest build -> dist/
npx tsc --noEmit   # typecheck without emitting
```

Jest with `ts-jest`; there is no separate lint step. Run one file with `npx jest src/identity-provider/services/authn-request.parser.spec.ts`, one case with `-t "<name>"`.

E2E specs call `startSamlDemo()` from `src/bootstrap.ts` directly, so they exercise the real module wiring, and they use their own ports — `npm start` can stay running while they execute.

`nest-cli.json` copies `**/views/**/*.ejs` and `**/public/**/*` into `dist/`. A new template or asset directory needs an entry there or the built app will 500 on render.

Note: `package-lock.json` is out of sync with `package.json`, so `npm ci` fails. Use `npm install`.

## What this repository is

A teaching demo of SAML 2.0 SSO. Two NestJS applications run in one process on separate ports, playing **Demo OpenAM (IdP, :4000)** and **JSL-online (SP, :3000)**, showing how the two sides actually cooperate through the browser.

The design doc is `docs/design/saml-sso-http.md` — read it before changing boundaries; it records the dependency direction and the reasoning behind each trade-off.

## Architecture (src/)

**Two independent applications first, technical layers second.** `src/identity-provider/` and `src/service-provider/` are separate Nest modules that never import each other — they cooperate over HTTP only. That is the primary boundary; preserve it.

```
src/main.ts                 CLI entry point: parseArgs for ports, prints the banner
src/bootstrap.ts            creates + starts both Nest applications
src/config/saml.config.ts   createSamlConfigs(ports) derives every entity ID and URL

src/identity-provider/      Demo OpenAM
  models/                   user-directory, service-provider-registry,
                            saml-response.factory, idp-metadata.factory
  services/                 issue-saml-response.use-case, xml-crypto-assertion-signer,
                            authn-request.parser, tampering.simulator
  controllers/ presenters/ views/
  identity-provider.module.ts

src/service-provider/       JSL-online
  models/                   authenticated-user
  services/                 start/complete-single-sign-on.use-case, node-saml.gateway,
                            session-store, idp-metadata.client
  controllers/ presenters/ views/
  service-provider.module.ts

src/shared/                 clock, saml-failure.filter, web-layer, x509-certificate,
                            signing-credential, saml-id, views/, public/
```

Where a file goes is decided by *what makes it change*: business rule → `models/`, workflow or external library → `services/`, wire protocol → `controllers/`, page output → `presenters/` + `views/`, swapping an implementation → the `*.module.ts`.

Rules that hold across the codebase:

- **Ports are abstract classes**, not interfaces — an interface does not exist at runtime and cannot be an injection token. `Clock`, `AssertionSigner`, `SamlGateway`, `SessionStore`. Use cases depend on the abstract class; only the module names an implementation (`{ provide: AssertionSigner, useClass: XmlCryptoAssertionSigner }`). Values with no class to hang off (config objects, metadata strings) use symbol tokens.
- **Each `*.module.ts` is the only place a port is bound to an implementation.** A spec swaps in a fake by binding the same token in `Test.createTestingModule`.
- `models/` and the use cases in `services/` import no `@nestjs/platform-express`, no `xml-crypto`, no `@node-saml/node-saml`. Those appear only in the adapter files under `services/`, in `controllers/`, and in the module files.
- No HTML or CSS in TypeScript. Markup lives in each application's `views/*.ejs`; `@Render("template")` names the view and the handler returns the model; a presenter builds that model. Escaping is EJS's `<%= %>` — don't hand-roll it. Every page opens with `include("_head", { title })` and closes with `include("_foot")`.
- `shared/web-layer.ts` sets each app's views to `[ownViews, sharedViews]` and mirrors that list into `app.locals.views` — Express does not forward its views setting to the template engine, and EJS resolves `include()` from `options.views`. Removing that line silently breaks every `include("_head")`.
- `ServiceProviderModule` declares the IdP certificate as an **async provider**: the SP app cannot finish initialising before it has fetched `GET /idp/metadata`. That ordering is the trust-establishment order and is the point of the demo; don't replace it with a hardcoded certificate.
- Ports (the TCP kind) are a parameter, not a constant: every entity ID and URL is derived from them in `createSamlConfigs()`. That is what lets the e2e suite run a second, isolated pair of apps.

Two boundaries that carry security meaning, not just structure:

- `identity-provider/models/service-provider-registry.ts` decides the ACS URL from the IdP's own registry, never from the AuthnRequest. Trusting the request's `AssertionConsumerServiceURL` would let an attacker redirect a valid assertion.
- `toSafeLandingPage()` in `service-provider/services/complete-single-sign-on.use-case.ts` restricts RelayState to local paths.

`tampering.simulator.ts` is demo-only, representing a man-in-the-middle between IdP and SP. It is deliberately not IdP business logic.

## The lesson the code is built to demonstrate

`xml-crypto` proves *the bytes were not modified*. `@node-saml/node-saml` proves *this login result is for us, right now, from the expected IdP*. Only `getSignedReferences()` returns XML the signature actually covers — never trust the surrounding document.

## Conventions

- Comments, docs, test names, and user-facing output are in English. Match that.
- TypeScript, CommonJS output (Nest's default), Node >= 24. Modern built-ins are preferred over dependencies: `node:util`'s `styleText` (no chalk) and `parseArgs`, `AbortSignal.timeout()`, `RegExp.escape()`, `Error` `cause` chains.
- `RegExp.escape` is ahead of TypeScript's lib; `test/regexp-escape.d.ts` declares it. Delete that file once the lib catches up.
- Jest's `node` environment isolates realms, so an error thrown inside a Node core module is not `instanceof Error` in a spec. Assert on shape, not constructor, when checking a preserved `cause`.
- XPath uses `local-name(.)` rather than namespace prefixes, since SAML documents vary in prefix choice.
- Comments explain *why* — a business rule, a security consequence, or a production-vs-demo difference. This repo exists to be read, so those comments are the deliverable; redundant step-by-step narration is not.
