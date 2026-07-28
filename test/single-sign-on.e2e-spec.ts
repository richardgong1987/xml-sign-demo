import { RunningApplications, startBothApplications } from "./start-both-applications";
import { Browser, createBrowser, readFormAction, readHiddenFields } from "./browser";

/*
 * Drives the whole SP-initiated SSO flow over real HTTP against both applications.
 *
 * Production starts each application from its own main.ts; startBothApplications() is
 * the test-only equivalent that puts the pair in one process.
 *
 * The ports deliberately avoid the 4000/3000 pair the two mains default to, so the
 * suite can run while a development server is up.
 */
const TEST_PORTS = { identityProviderPort: 14000, serviceProviderPort: 15000 };

const SESSION_COOKIE = "sp_session";

let demo: RunningApplications;
let identityProviderBaseUrl: string;
let serviceProviderBaseUrl: string;

beforeAll(async () => {
    demo = await startBothApplications(TEST_PORTS);
    identityProviderBaseUrl = `http://localhost:${demo.identityProviderConfig.port}`;
    serviceProviderBaseUrl = `http://localhost:${demo.serviceProviderConfig.port}`;
}, 30_000);

afterAll(async () => {
    await demo.stop();
});

describe("trust establishment", () => {
    it("imports entity ID, SSO URL, and signing certificate from the IdP metadata at startup", () => {
        expect(demo.identityProviderTrust.entityId).toBe(demo.identityProviderConfig.entityId);
        expect(demo.identityProviderTrust.singleSignOnUrl).toBe(demo.identityProviderConfig.singleSignOnUrl);
        expect(demo.identityProviderTrust.signingCertificatePem).toMatch(/^-----BEGIN CERTIFICATE-----/);
    });

    it("publishes the signing certificate and an HTTP-Redirect SSO endpoint in the IdP metadata", async () => {
        const response = await fetch(`${identityProviderBaseUrl}/idp/metadata`);
        const metadata = await response.text();

        expect(response.status).toBe(200);
        expect(metadata).toMatch(/<md:KeyDescriptor use="signing">/);
        expect(metadata).toMatch(/Binding="urn:oasis:names:tc:SAML:2\.0:bindings:HTTP-Redirect"/);
        expect(metadata).toContain(demo.identityProviderConfig.singleSignOnUrl);
    });

    it("publishes the ACS URL and demands signed assertions in the SP metadata", async () => {
        const response = await fetch(`${serviceProviderBaseUrl}/api/saml/metadata`);
        const metadata = await response.text();

        expect(response.status).toBe(200);
        expect(metadata).toMatch(/WantAssertionsSigned="true"/);
        expect(metadata).toContain(demo.serviceProviderConfig.assertionConsumerServiceUrl);
    });
});

describe("single sign-on", () => {
    it("redirects to the IdP carrying SAMLRequest and RelayState", async () => {
        const authorizeUrl = new URL(await startLogin(createBrowser(), "/profile"));

        expect(authorizeUrl.origin + authorizeUrl.pathname).toBe(
            demo.identityProviderConfig.singleSignOnUrl,
        );
        expect(authorizeUrl.searchParams.get("SAMLRequest")).toBeTruthy();
        expect(authorizeUrl.searchParams.get("RelayState")).toBe("/profile");
    });

    it("shows the AuthnRequest context the IdP parsed", async () => {
        const browser = createBrowser();
        const loginPage = await openIdpLoginPage(browser, await startLogin(browser, "/profile"));

        expect(loginPage.html).toContain(demo.serviceProviderConfig.entityId);
        expect(loginPage.fields.relayState).toBe("/profile");
        expect(loginPage.fields.authnRequestId).toMatch(/^_[0-9a-f]+$/);
    });

    it("opens an SP session and shows the asserted user", async () => {
        const browser = createBrowser();

        const acsResponse = await runSingleSignOn(browser, { uid: "hanjin" });

        expect(acsResponse.status).toBe(302);
        expect(acsResponse.headers.get("location")).toBe("/profile");
        expect(browser.hasCookie(SESSION_COOKIE)).toBe(true);

        const profile = await browser.get(`${serviceProviderBaseUrl}/profile`);
        const html = await profile.text();

        expect(profile.status).toBe(200);
        expect(html).toContain("hanjin@example.test");
        expect(html).toContain("trader");
    });

    it("returns the user to the page they wanted before signing in", async () => {
        const acsResponse = await runSingleSignOn(createBrowser(), {
            uid: "sakura",
            returnTo: "/orders/42",
        });

        expect(acsResponse.headers.get("location")).toBe("/orders/42");
    });

    it("redirects to the home page when /profile is requested without a session", async () => {
        const response = await createBrowser().get(`${serviceProviderBaseUrl}/profile`);

        expect(response.status).toBe(302);
        expect(response.headers.get("location")).toBe("/");
    });

    it("invalidates the session on sign-out", async () => {
        const browser = createBrowser();
        await runSingleSignOn(browser, { uid: "hanjin" });

        await browser.postForm(`${serviceProviderBaseUrl}/logout`, {});

        expect(browser.hasCookie(SESSION_COOKIE)).toBe(false);

        const profile = await browser.get(`${serviceProviderBaseUrl}/profile`);
        expect(profile.headers.get("location")).toBe("/");
    });
});

describe("rejected assertions", () => {
    it("refuses to open a session after a man-in-the-middle edits role", async () => {
        const browser = createBrowser();

        const acsResponse = await runSingleSignOn(browser, { uid: "hanjin", shouldTamper: true });

        expect(acsResponse.status).toBe(400);
        expect(await acsResponse.text()).toMatch(/Invalid signature/);
        expect(browser.hasCookie(SESSION_COOKIE)).toBe(false);
    });

    it("rejects a replayed SAMLResponse", async () => {
        const browser = createBrowser();
        const autoPostForm = await issueSamlResponse(browser, { uid: "hanjin" });

        const firstAttempt = await browser.postForm(autoPostForm.action, autoPostForm.fields);
        expect(firstAttempt.status).toBe(302);

        // InResponseTo can be redeemed once only; a replayed assertion matches no
        // outstanding AuthnRequest.
        const replay = await createBrowser().postForm(autoPostForm.action, autoPostForm.fields);

        expect(replay.status).toBe(400);
        expect(await replay.text()).toMatch(/InResponseTo/i);
    });

    it("rejects a malformed AuthnRequest at the IdP", async () => {
        const response = await fetch(`${identityProviderBaseUrl}/idp/sso?SAMLRequest=%21%21%21bad`);

        expect(response.status).toBe(400);
        expect(await response.text()).toMatch(/Cannot parse the AuthnRequest/);
    });
});

/*
 * The browser behaviour below is split into four steps, in the same order as the
 * sequence diagram in the README.
 */

async function startLogin(browser: Browser, returnTo: string): Promise<string> {
    const response = await browser.get(
        `${serviceProviderBaseUrl}/login?returnTo=${encodeURIComponent(returnTo)}`,
    );

    expect(response.status).toBe(302);

    return response.headers.get("location")!;
}

async function openIdpLoginPage(
    browser: Browser,
    authorizeUrl: string,
): Promise<{ html: string; fields: Record<string, string> }> {
    const html = await (await browser.get(authorizeUrl)).text();

    return { html, fields: readHiddenFields(html) };
}

async function issueSamlResponse(
    browser: Browser,
    { uid, returnTo = "/profile", shouldTamper = false }: {
        uid: string;
        returnTo?: string;
        shouldTamper?: boolean;
    },
): Promise<{ action: string; fields: Record<string, string> }> {
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

async function runSingleSignOn(
    browser: Browser,
    options: { uid: string; returnTo?: string; shouldTamper?: boolean },
): Promise<Response> {
    const autoPostForm = await issueSamlResponse(browser, options);

    return browser.postForm(autoPostForm.action, autoPostForm.fields);
}
