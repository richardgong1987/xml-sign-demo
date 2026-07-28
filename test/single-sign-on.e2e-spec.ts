import {RunningApplications, startBothApplications} from "./start-both-applications";
import {
    get,
    postForm,
    readFormAction,
    readHiddenFields,
    readTokenHandoff,
    TokenHandoff,
} from "./http-client";
import {UserDirectory} from "../src/identity-provider/models/user-directory";

/*
 * Drives the whole SP-initiated SSO flow over real HTTP against both applications.
 *
 * Production starts each application from its own main.ts; startBothApplications() is
 * the test-only equivalent that puts the pair in one process.
 *
 * The ports deliberately avoid the 4000/3000 pair the two mains default to, so the
 * suite can run while a development server is up.
 */
const TEST_PORTS = {identityProviderPort: 14000, serviceProviderPort: 15000};

// Whoever the IdP's directory holds — the spec should not care about the fixture.
const [DEMO_USER] = new UserDirectory().list();

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
        expect(demo.identityProviderTrust.singleSignOnUrl).toBe(
            demo.identityProviderConfig.singleSignOnUrl,
        );
        expect(demo.identityProviderTrust.signingCertificatePem).toMatch(/^-----BEGIN CERTIFICATE-----/);
    });

    it("publishes the signing certificate and an HTTP-Redirect SSO endpoint in the IdP metadata", async () => {
        const response = await get(`${identityProviderBaseUrl}/idp/metadata`);
        const metadata = await response.text();

        expect(response.status).toBe(200);
        expect(metadata).toMatch(/<md:KeyDescriptor use="signing">/);
        expect(metadata).toMatch(/Binding="urn:oasis:names:tc:SAML:2\.0:bindings:HTTP-Redirect"/);
        expect(metadata).toContain(demo.identityProviderConfig.singleSignOnUrl);
    });

    it("publishes the ACS URL and demands signed assertions in the SP metadata", async () => {
        const response = await get(`${serviceProviderBaseUrl}/api/saml/metadata`);
        const metadata = await response.text();

        expect(response.status).toBe(200);
        expect(metadata).toMatch(/WantAssertionsSigned="true"/);
        expect(metadata).toContain(demo.serviceProviderConfig.assertionConsumerServiceUrl);
    });
});

describe("single sign-on", () => {
    it("redirects to the IdP carrying SAMLRequest and RelayState", async () => {
        const authorizeUrl = new URL(await startLogin("/profile"));

        expect(authorizeUrl.origin + authorizeUrl.pathname).toBe(
            demo.identityProviderConfig.singleSignOnUrl,
        );
        expect(authorizeUrl.searchParams.get("SAMLRequest")).toBeTruthy();
        expect(authorizeUrl.searchParams.get("RelayState")).toBe("/profile");
    });

    it("shows the AuthnRequest context the IdP parsed", async () => {
        const loginPage = await openIdpLoginPage(await startLogin("/profile"));

        expect(loginPage.html).toContain(demo.serviceProviderConfig.entityId);
        expect(loginPage.fields.relayState).toBe("/profile");
        expect(loginPage.fields.authnRequestId).toMatch(/^_[0-9a-f]+$/);
    });

    it("hands the browser a JWT and points it at the requested page", async () => {
        const handoff = await runSingleSignOn({uid: DEMO_USER.uid});

        // header.payload.signature — the SP signed this itself; it is not the assertion.
        expect(handoff.accessToken.split(".")).toHaveLength(3);
        expect(handoff.returnTo).toBe("/profile");
    });

    it("returns the user to the page they wanted before signing in", async () => {
        const handoff = await runSingleSignOn({uid: DEMO_USER.uid, returnTo: "/orders/42"});

        expect(handoff.returnTo).toBe("/orders/42");
    });

    it("answers /api/me with the asserted user when the token is presented", async () => {
        const {accessToken} = await runSingleSignOn({uid: DEMO_USER.uid});

        const response = await get(`${serviceProviderBaseUrl}/api/me`, accessToken);

        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({
            fields: [
                {label: "NameID", value: DEMO_USER.uid},
                {label: "uid", value: DEMO_USER.uid},
                {label: "email", value: DEMO_USER.email},
                {label: "role", value: DEMO_USER.role},
                {label: "SessionIndex", value: expect.stringMatching(/^_/)},
            ],
        });
    });

    it("serves /profile as a shell that verifies the token client-side", async () => {
        // The server holds no session, so this page renders the same whether or not the
        // caller is signed in; its script is what decides.
        const response = await get(`${serviceProviderBaseUrl}/profile`);

        expect(response.status).toBe(200);
        expect(await response.text()).toContain("Checking the access token");
    });
});

describe("access token", () => {
    it("rejects a request that carries no token", async () => {
        const response = await get(`${serviceProviderBaseUrl}/api/me`);

        expect(response.status).toBe(401);
    });

    it.each(["not-a-jwt", "a.b.c"])("rejects a malformed token (%p)", async (token) => {
        const response = await get(`${serviceProviderBaseUrl}/api/me`, token);

        expect(response.status).toBe(401);
    });

    it("rejects a token whose payload was edited after signing", async () => {
        const {accessToken} = await runSingleSignOn({uid: DEMO_USER.uid});

        const response = await get(
            `${serviceProviderBaseUrl}/api/me`,
            promoteToAdministrator(accessToken),
        );

        expect(response.status).toBe(401);
    });

    it("still accepts a token after the browser signed out, because nothing revokes it", async () => {
        const {accessToken} = await runSingleSignOn({uid: DEMO_USER.uid});

        // Signing out only clears localStorage. Anyone who copied the token beforehand
        // keeps access until it expires — the price of a self-contained credential.
        const response = await get(`${serviceProviderBaseUrl}/api/me`, accessToken);

        expect(response.status).toBe(200);
    });
});

describe("rejected assertions", () => {
    it("refuses to issue a token after a man-in-the-middle edits role", async () => {
        const response = await postAssertion(
            await issueSamlResponse({uid: DEMO_USER.uid, shouldTamper: true}),
        );

        expect(response.status).toBe(400);
        expect(await response.text()).toMatch(/Invalid signature/);
    });

    it("rejects a replayed SAMLResponse", async () => {
        const autoPostForm = await issueSamlResponse({uid: DEMO_USER.uid});

        expect((await postAssertion(autoPostForm)).status).toBe(200);

        // InResponseTo can be redeemed once only; a replayed assertion matches no
        // outstanding AuthnRequest.
        const replay = await postAssertion(autoPostForm);

        expect(replay.status).toBe(400);
        expect(await replay.text()).toMatch(/InResponseTo/i);
    });

    it("rejects a malformed AuthnRequest at the IdP", async () => {
        const response = await get(`${identityProviderBaseUrl}/idp/sso?SAMLRequest=%21%21%21bad`);

        expect(response.status).toBe(400);
        expect(await response.text()).toMatch(/Cannot parse the AuthnRequest/);
    });
});

/*
 * The browser behaviour below is split into the same steps as the sequence diagram in
 * the README.
 */

async function startLogin(returnTo: string): Promise<string> {
    const response = await get(
        `${serviceProviderBaseUrl}/login?returnTo=${encodeURIComponent(returnTo)}`,
    );

    expect(response.status).toBe(302);

    return response.headers.get("location")!;
}

async function openIdpLoginPage(
    authorizeUrl: string,
): Promise<{ html: string; fields: Record<string, string> }> {
    const html = await (await get(authorizeUrl)).text();

    return {html, fields: readHiddenFields(html)};
}

interface AutoPostForm {
    readonly action: string;
    readonly fields: Record<string, string>;
}

async function issueSamlResponse({
    uid,
    returnTo = "/profile",
    shouldTamper = false,
}: {
    uid: string;
    returnTo?: string;
    shouldTamper?: boolean;
}): Promise<AutoPostForm> {
    const loginPage = await openIdpLoginPage(await startLogin(returnTo));

    const html = await (
        await postForm(`${identityProviderBaseUrl}/idp/login`, {
            ...loginPage.fields,
            uid,
            ...(shouldTamper ? {tamper: "on"} : {}),
        })
    ).text();

    return {action: readFormAction(html, "saml-post-form"), fields: readHiddenFields(html)};
}

function postAssertion(autoPostForm: AutoPostForm): Promise<Response> {
    return postForm(autoPostForm.action, autoPostForm.fields);
}

async function runSingleSignOn(options: {
    uid: string;
    returnTo?: string;
    shouldTamper?: boolean;
}): Promise<TokenHandoff> {
    const response = await postAssertion(await issueSamlResponse(options));

    expect(response.status).toBe(200);

    return readTokenHandoff(await response.text());
}

/** Re-encodes the payload with a different role, leaving the original signature behind. */
function promoteToAdministrator(accessToken: string): string {
    const [header, payload, signature] = accessToken.split(".");
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));

    const forged = Buffer.from(JSON.stringify({...claims, role: "administrator"}), "utf8").toString(
        "base64url",
    );

    return [header, forged, signature].join(".");
}
