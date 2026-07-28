import { test, before, after } from "node:test";
import assert from "node:assert/strict";

import { startSamlDemo } from "../../src/bootstrap.js";
import { createBrowser, readHiddenFields, readFormAction } from "./browser.js";

/*
 * Drives the whole SP-initiated SSO flow over real HTTP.
 *
 * The ports deliberately avoid the 4000/5000 pair used by npm start, so the suite can
 * run while a development server is up.
 */
const TEST_PORTS = Object.freeze({ identityProviderPort: 14000, serviceProviderPort: 15000 });

const SESSION_COOKIE = "sp_session";

let demo;
let identityProviderBaseUrl;
let serviceProviderBaseUrl;

before(async () => {
    demo = await startSamlDemo(TEST_PORTS);
    identityProviderBaseUrl = `http://localhost:${demo.identityProviderConfig.port}`;
    serviceProviderBaseUrl = `http://localhost:${demo.serviceProviderConfig.port}`;
});

after(async () => {
    await demo.stop();
});

test("the SP imports entity ID, SSO URL, and signing certificate from the IdP metadata at startup", () => {
    assert.equal(demo.identityProvider.entityId, demo.identityProviderConfig.entityId);
    assert.equal(demo.identityProvider.singleSignOnUrl, demo.identityProviderConfig.singleSignOnUrl);
    assert.match(demo.identityProvider.signingCertificatePem, /^-----BEGIN CERTIFICATE-----/);
});

test("the IdP metadata publishes the signing certificate and an HTTP-Redirect SSO endpoint", async () => {
    const response = await fetch(`${identityProviderBaseUrl}/idp/metadata`);
    const metadata = await response.text();

    assert.equal(response.status, 200);
    assert.match(metadata, /<md:KeyDescriptor use="signing">/);
    assert.match(metadata, /Binding="urn:oasis:names:tc:SAML:2\.0:bindings:HTTP-Redirect"/);
    assert.ok(metadata.includes(demo.identityProviderConfig.singleSignOnUrl));
});

test("the SP metadata publishes the ACS URL and demands signed assertions", async () => {
    const response = await fetch(`${serviceProviderBaseUrl}/api/saml/metadata`);
    const metadata = await response.text();

    assert.equal(response.status, 200);
    assert.match(metadata, /WantAssertionsSigned="true"/);
    assert.ok(metadata.includes(demo.serviceProviderConfig.assertionConsumerServiceUrl));
});

test("GET /login redirects to the IdP carrying SAMLRequest and RelayState", async () => {
    const authorizeUrl = new URL(await startLogin(createBrowser(), "/profile"));

    assert.equal(authorizeUrl.origin + authorizeUrl.pathname, demo.identityProviderConfig.singleSignOnUrl);
    assert.ok(authorizeUrl.searchParams.get("SAMLRequest"));
    assert.equal(authorizeUrl.searchParams.get("RelayState"), "/profile");
});

test("the IdP login page shows the AuthnRequest context it parsed", async () => {
    const browser = createBrowser();
    const loginPage = await openIdpLoginPage(browser, await startLogin(browser, "/profile"));

    assert.ok(loginPage.html.includes(demo.serviceProviderConfig.entityId));
    assert.equal(loginPage.fields.relayState, "/profile");
    assert.match(loginPage.fields.authnRequestId, /^_[0-9a-f]+$/);
});

test("full flow: a successful sign-in opens an SP session and shows the asserted user", async () => {
    const browser = createBrowser();

    const acsResponse = await runSingleSignOn(browser, { uid: "hanjin" });

    assert.equal(acsResponse.status, 302);
    assert.equal(acsResponse.headers.get("location"), "/profile");
    assert.ok(browser.hasCookie(SESSION_COOKIE));

    const profile = await browser.get(`${serviceProviderBaseUrl}/profile`);
    const html = await profile.text();

    assert.equal(profile.status, 200);
    assert.ok(html.includes("hanjin@example.test"));
    assert.ok(html.includes("trader"));
});

test("RelayState returns the user to the page they wanted before signing in", async () => {
    const browser = createBrowser();

    const acsResponse = await runSingleSignOn(browser, { uid: "sakura", returnTo: "/orders/42" });

    assert.equal(acsResponse.headers.get("location"), "/orders/42");
});

test("requesting /profile without a session redirects to the home page", async () => {
    const response = await createBrowser().get(`${serviceProviderBaseUrl}/profile`);

    assert.equal(response.status, 302);
    assert.equal(response.headers.get("location"), "/");
});

test("signing out invalidates the session", async () => {
    const browser = createBrowser();
    await runSingleSignOn(browser, { uid: "hanjin" });

    await browser.postForm(`${serviceProviderBaseUrl}/logout`, {});

    assert.equal(browser.hasCookie(SESSION_COOKIE), false);

    const profile = await browser.get(`${serviceProviderBaseUrl}/profile`);
    assert.equal(profile.headers.get("location"), "/");
});

test("after a man-in-the-middle edits role, the SP refuses to open a session", async () => {
    const browser = createBrowser();

    const acsResponse = await runSingleSignOn(browser, { uid: "hanjin", shouldTamper: true });

    assert.equal(acsResponse.status, 400);
    assert.match(await acsResponse.text(), /Invalid signature/);
    assert.equal(browser.hasCookie(SESSION_COOKIE), false);
});

test("replaying the same SAMLResponse is rejected", async () => {
    const browser = createBrowser();
    const autoPostForm = await issueSamlResponse(browser, { uid: "hanjin" });

    const firstAttempt = await browser.postForm(autoPostForm.action, autoPostForm.fields);
    assert.equal(firstAttempt.status, 302);

    // InResponseTo can be redeemed once only; a replayed assertion matches no outstanding AuthnRequest.
    const replay = await createBrowser().postForm(autoPostForm.action, autoPostForm.fields);

    assert.equal(replay.status, 400);
    assert.match(await replay.text(), /InResponseTo/i);
});

/*
 * The browser behaviour below is split into four steps, in the same order as the
 * sequence diagram in the README.
 */

async function startLogin(browser, returnTo) {
    const response = await browser.get(
        `${serviceProviderBaseUrl}/login?returnTo=${encodeURIComponent(returnTo)}`,
    );

    assert.equal(response.status, 302, "GET /login should redirect to the IdP");

    return response.headers.get("location");
}

async function openIdpLoginPage(browser, authorizeUrl) {
    const html = await (await browser.get(authorizeUrl)).text();

    return { html, fields: readHiddenFields(html) };
}

async function issueSamlResponse(browser, { uid, returnTo = "/profile", shouldTamper = false }) {
    const loginPage = await openIdpLoginPage(browser, await startLogin(browser, returnTo));

    const html = await (
        await browser.postForm(`${identityProviderBaseUrl}/idp/login`, {
            ...loginPage.fields,
            uid,
            ...(shouldTamper ? { tamper: "on" } : {}),
        })
    ).text();

    return { action: readFormAction(html, "saml-post-form"), fields: readHiddenFields(html) };
}

async function runSingleSignOn(browser, options) {
    const autoPostForm = await issueSamlResponse(browser, options);

    return browser.postForm(autoPostForm.action, autoPostForm.fields);
}
