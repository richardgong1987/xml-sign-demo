# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install            # installs every workspace
npm run build          # nest build + next build — run before test:e2e or start
npm test               # 47 unit + 16 end-to-end — the verification loop
npm run test:unit      # both apps, no HTTP or keys needed
npm run test:e2e       # builds and starts both applications for real
npm run typecheck      # tsc --noEmit in every workspace

npm run start:idp      # Demo OpenAM on :4000   (-- --port N --sp-url URL)
npm run start:sp       # JSL-online on :3000    (SP_BASE_URL / IDP_BASE_URL / SP_ACCESS_TOKEN_SECRET)
npm run dev:idp        # nest start --watch
npm run dev:sp         # next dev
```

Run one workspace's tests with `npm test --workspace @saml-demo/identity-provider`; one file with `npx jest <path>` from inside that workspace.

There is no single command that starts both — that is the point of the split. Start the IdP first: the SP imports its certificate on first use and the request fails if the IdP is unreachable.

`npm run test:e2e` needs a build. It is the only code that runs both applications at once (`e2e/run-applications.ts`), spawning `node apps/identity-provider/dist/main.js` and `next start`.

Note: `package-lock.json` may be out of sync, so `npm ci` can fail. Use `npm install`. Never create a second lockfile inside a workspace — Next warns and picks the wrong tracing root.

## What this repository is

A teaching demo of SAML 2.0 SSO across two deliberately different stacks:

- **`apps/identity-provider`** — Demo OpenAM, on **NestJS** (EJS views, xml-crypto signing)
- **`apps/service-provider`** — JSL-online, on **Next.js** (App Router, React, jose)

They are separate npm workspaces and import nothing from each other. The point is that SAML is an interoperability protocol: the only thing they share is HTTP.

The design doc is `docs/design/saml-sso-http.md` — read it before changing boundaries.

## Architecture

**Two independently deployable applications first, technical layers second.** Preserve that: if something seems to belong to both, it belongs to neither — duplicate it or send it over HTTP. `x509-certificate.ts` exists in both on purpose.

### apps/identity-provider (NestJS)

```
src/main.ts                     entry point; parseArgs for --port and --sp-url
src/identity-provider.config.ts its config + the SP registry it was told to trust
src/models/                     user-directory, service-provider-registry,
                                saml-response.factory, idp-metadata.factory
src/services/                   issue-saml-response.use-case, xml-crypto-assertion-signer,
                                authn-request.parser, signing-credential, tampering.simulator
src/controllers/ presenters/ views/
src/shared/                     clock, saml-failure.filter, web-layer, x509-certificate
src/identity-provider.module.ts binds every port to an implementation
```

- **Ports are abstract classes**, not interfaces — an interface does not exist at runtime and cannot be a Nest injection token. `Clock`, `AssertionSigner`. Values with no class (config objects, metadata strings) use symbol tokens.
- `identity-provider.module.ts` is the only place a port is bound. A spec swaps in a fake by binding the same token in `Test.createTestingModule`.
- No HTML in TypeScript: markup lives in `views/*.ejs`, `@Render("template")` names the view, a presenter builds the model. `shared/web-layer.ts` mirrors the views list into `app.locals.views` — Express does not forward its views setting to the template engine, and removing that line silently breaks every `include("_head")`.
- `nest-cli.json` copies `**/views/**/*.ejs` and `**/public/**/*` into `dist/`.

### apps/service-provider (Next.js)

```
app/                            App Router — pages and route handlers only
  page.tsx  profile/  login/route.ts  api/{saml/metadata,saml/acs,me}/
src/config/                     reads SP_BASE_URL, IDP_BASE_URL, SP_ACCESS_TOKEN_SECRET
src/domain/                     authenticated-user.ts
src/services/                   use cases, node-saml.gateway, jose issuer, idp-metadata.client
src/presenters/                 profile.presenter.ts
src/service-provider.runtime.ts the composition root — one memoised factory
src/token-handoff.page.ts       the document that moves the JWT into localStorage
```

- **Ports are plain interfaces here.** Without a DI container nothing needs the type at runtime, so `SamlGateway` and `AccessTokenIssuer` are interfaces and fakes are object literals.
- `src/` contains no Next imports and `app/` contains no business logic. That separation is what let this half move over from NestJS almost unchanged; keep it.
- Every route handler touching node-saml needs `export const runtime = "nodejs"` and `export const dynamic = "force-dynamic"`.
- `next.config.ts` lists node-saml, xml-crypto, xmldom and xpath as `serverExternalPackages`, and pins `outputFileTracingRoot` to the workspace root.
- **A route handler may not import `react-dom/server`** — Next rejects the build. That is why `token-handoff.page.ts` builds its markup as a string, with its own `escapeHtml`.
- The trust import is memoised in `service-provider.runtime.ts` rather than done at boot: Next gives no reliable startup hook, so a route handler may be the first thing that runs.

### Sign-in state

The SP keeps nothing. After the assertion validates it signs its own JWT (HS256, `jose`, 15 minutes) and returns the hand-off page — the IdP POSTed from its own origin, so only a script served by the SP can write to the SP's localStorage. Every later call carries `Authorization: Bearer <jwt>`; `src/bearer-token.ts` answers the only question that matters. Signing out deletes the key, and nothing revokes the token before `exp` — there is an e2e test asserting exactly that, so the property stays visible.

The algorithm is pinned on both sign and verify. Trusting the token's own header is the classic JWT confusion bug.

Two boundaries that carry security meaning, not just structure:

- `identity-provider/src/models/service-provider-registry.ts` decides the ACS URL from the IdP's own registry, never from the AuthnRequest.
- `toSafeLandingPage()` in `service-provider/src/services/complete-single-sign-on.use-case.ts` restricts RelayState to local paths.

`tampering.simulator.ts` is demo-only, standing in for a man-in-the-middle. It is deliberately not IdP business logic.

## The lesson the code is built to demonstrate

`xml-crypto` proves *the bytes were not modified*. `@node-saml/node-saml` proves *this login result is for us, right now, from the expected IdP*. Only `getSignedReferences()` returns XML the signature actually covers — never trust the surrounding document.

## Conventions

- Comments, docs, test names, and user-facing output are in English. Match that.
- TypeScript everywhere, Node >= 24. Pin `typescript` to 5.x: TypeScript 7 (the native port) does not expose the API ts-jest needs.
- Modern built-ins over dependencies: `node:util`'s `styleText` and `parseArgs`, `AbortSignal.timeout()`, `RegExp.escape()`, `Error` `cause` chains.
- `RegExp.escape` is ahead of TypeScript's lib; `e2e/regexp-escape.d.ts` declares it.
- `jose` is ESM-only, so the SP's `jest.config.js` transforms it via `transformIgnorePatterns`.
- Jest's `node` environment isolates realms, so an error thrown inside a Node core module is not `instanceof Error` in a spec. Assert on shape, not constructor, when checking a preserved `cause`.
- XPath uses `local-name(.)` rather than namespace prefixes, since SAML documents vary in prefix choice.
- Comments explain *why* — a business rule, a security consequence, or a production-vs-demo difference. This repo exists to be read.
