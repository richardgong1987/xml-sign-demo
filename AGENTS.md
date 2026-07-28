# AGENTS.md

## Project overview

This repository is a teaching demo of SAML 2.0 single sign-on. It starts two
independent NestJS applications in one process:

- Demo OpenAM, the identity provider (IdP), on port 4000 by default.
- JSL-online, the service provider (SP), on port 3000 by default.

The applications cooperate through HTTP and the browser. Read
`docs/design/saml-sso-http.md` before changing boundaries, trust establishment,
or the SSO flow.

## Environment and commands

- Use Node.js 24 or newer and npm.
- Install dependencies with `npm install`. The ignored local `package-lock.json`
  may be out of sync, so do not assume `npm ci` works.
- Start the demo with `npm start`.
- Override ports with `npm start -- --idp-port 4001 --sp-port 3001`.
- Run all tests with `npm test`.
- Run unit tests with `npm run test:unit`.
- Run end-to-end tests with `npm run test:e2e`.
- Run one spec with `npx jest path/to/file.spec.ts` and one case with
  `npx jest path/to/file.spec.ts -t "case name"`.
- Build with `npm run build`.
- Type-check without emitting with `npx tsc --noEmit`.
- There is no separate lint command.

Before completing a code change, run the narrowest relevant test first, then
`npm test`, `npx tsc --noEmit`, and `npm run build` when practical. Report any
command that could not be run.

## Repository layout

- `src/identity-provider/`: IdP models, use cases, adapters, controllers,
  presenters, views, and module wiring.
- `src/service-provider/`: SP models, use cases, adapters, controllers,
  presenters, views, and module wiring.
- `src/shared/`: deliberately shared infrastructure such as the clock, failure
  filter, signing credential, X.509 helpers, common views, and CSS.
- `src/config/saml.config.ts`: derives all entity IDs and URLs from runtime ports.
- `src/bootstrap.ts`: creates and starts both Nest applications in trust order.
- `test/`: real-HTTP end-to-end tests and the small browser helper.
- `docs/design/saml-sso-http.md`: architecture, dependency direction, security
  rules, and test strategy.

Within each application, place code according to its reason to change:

- Business rules belong in `models/`.
- Workflows and external-library adapters belong in `services/`.
- Wire protocol translation belongs in `controllers/`.
- Page-model construction belongs in `presenters/`; markup belongs in `views/`.
- Dependency bindings belong in the application's `*.module.ts`.

## Architecture rules

- Preserve the IdP/SP boundary. The two application directories must not import
  from one another; they communicate over HTTP only.
- Use abstract classes for injectable ports such as `Clock`, `AssertionSigner`,
  `SamlGateway`, and `SessionStore`. Interfaces cannot be Nest injection tokens.
- Bind each port to its implementation only in the relevant `*.module.ts`. Tests
  replace the same token with fakes through `Test.createTestingModule`.
- Keep models and use cases independent of Express, `xml-crypto`, and
  `@node-saml/node-saml`. External libraries belong in adapter, controller, or
  module code.
- Keep all entity IDs and URLs derived from `createSamlConfigs()` and its port
  arguments. Do not introduce fixed localhost URLs into application logic.
- Preserve startup trust ordering: the IdP listens first, and the SP imports the
  IdP entity ID, SSO URL, and certificate from metadata through its async provider.
  Never give the SP the IdP private key or replace metadata import with a hardcoded
  certificate.

## Security invariants

- The IdP chooses the assertion consumer service URL from
  `ServiceProviderRegistry`, never from the incoming AuthnRequest.
- The SP must verify the signature and protocol constraints before creating a
  session: issuer trust, Audience, Recipient, validity time, and `InResponseTo`.
- Treat only XML returned by `xml-crypto`'s `getSignedReferences()` as signed.
  Never trust an unsigned surrounding document.
- Keep RelayState redirects restricted to local paths. Off-site and protocol-
  relative values must fall back to the default landing page.
- `tampering.simulator.ts` is teaching-only attack simulation, not IdP business
  logic or a production feature.
- Do not weaken rejection-path tests when changing XML parsing or validation.

## Views and assets

- Do not put HTML or CSS in TypeScript. Use EJS views, presenters, and
  `src/shared/public/demo.css`.
- Use EJS `<%= %>` escaping rather than hand-written escaping.
- Pages include the shared `_head` and `_foot` templates.
- `src/shared/web-layer.ts` must configure both Express's view directories and
  `app.locals.views`; EJS includes depend on both.
- If adding a new template or public asset location, update `nest-cli.json` so it
  is copied into `dist/`, then verify the built application can render it.

## Testing conventions

- Colocate unit specs as `src/**/*.spec.ts`; keep them independent of HTTP and
  real key material where possible.
- Use `Test.createTestingModule` for Nest providers and bind fakes to the same
  abstract ports or symbol tokens used in production.
- Keep end-to-end coverage in `test/*.e2e-spec.ts`. The suite calls
  `startSamlDemo()` and uses ports 14000/15000, so it can run beside the default
  development pair.
- Add or update tests for success and rejection paths when changing trust,
  parsing, redirects, sessions, signatures, or module wiring.
- In Jest, errors originating in Node core can cross realms and fail
  `instanceof Error`; assert their shape and `cause` instead.
- Prefer XPath expressions based on `local-name(.)` because SAML namespace
  prefixes vary.

## Code conventions

- Use strict TypeScript and CommonJS output; follow the existing four-space
  indentation and double-quoted strings.
- Keep comments, documentation, test names, and user-facing text in English.
- Prefer Node 24 built-ins over extra dependencies, including `parseArgs`,
  `styleText`, `AbortSignal.timeout()`, `RegExp.escape()`, and `Error` cause chains.
- Comments should explain business intent, security consequences, architectural
  constraints, or demo-versus-production trade-offs, not narrate obvious code.
- Keep changes focused. Do not commit generated `dist/`, dependencies, IDE files,
  or ignored lockfiles.
