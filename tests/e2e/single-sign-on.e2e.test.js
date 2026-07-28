"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const { startSamlDemo } = require("../../src/bootstrap");
const { createBrowser, readHiddenFields, readFormAction } = require("./browser");

/*
 * 用真实的 HTTP 走完整的 SP-initiated SSO 流程。
 *
 * 端口刻意避开 npm start 用的 4000/5000，
 * 这样开着开发服务器也能跑测试。
 */
const TEST_PORTS = Object.freeze({ identityProviderPort: 14000, serviceProviderPort: 15000 });

const SESSION_COOKIE = "sp_session";

let demo;
let identityProviderBaseUrl;
let serviceProviderBaseUrl;

test.before(async () => {
    demo = await startSamlDemo(TEST_PORTS);
    identityProviderBaseUrl = `http://localhost:${demo.identityProviderConfig.port}`;
    serviceProviderBaseUrl = `http://localhost:${demo.serviceProviderConfig.port}`;
});

test.after(async () => {
    await demo.stop();
});

test("SP 启动时从 IdP metadata 导入 Entity ID、SSO 地址和签名证书", () => {
    assert.equal(demo.identityProvider.entityId, demo.identityProviderConfig.entityId);
    assert.equal(demo.identityProvider.singleSignOnUrl, demo.identityProviderConfig.singleSignOnUrl);
    assert.match(demo.identityProvider.signingCertificatePem, /^-----BEGIN CERTIFICATE-----/);
});

test("IdP metadata 公布签名证书与 HTTP-Redirect 的 SSO 地址", async () => {
    const response = await fetch(`${identityProviderBaseUrl}/idp/metadata`);
    const metadata = await response.text();

    assert.equal(response.status, 200);
    assert.match(metadata, /<md:KeyDescriptor use="signing">/);
    assert.match(metadata, /Binding="urn:oasis:names:tc:SAML:2\.0:bindings:HTTP-Redirect"/);
    assert.ok(metadata.includes(demo.identityProviderConfig.singleSignOnUrl));
});

test("SP metadata 公布 ACS 地址，并声明要求 Assertion 已签名", async () => {
    const response = await fetch(`${serviceProviderBaseUrl}/api/saml/metadata`);
    const metadata = await response.text();

    assert.equal(response.status, 200);
    assert.match(metadata, /WantAssertionsSigned="true"/);
    assert.ok(metadata.includes(demo.serviceProviderConfig.assertionConsumerServiceUrl));
});

test("GET /login 带着 SAMLRequest 与 RelayState 跳转到 IdP", async () => {
    const authorizeUrl = new URL(await startLogin(createBrowser(), "/profile"));

    assert.equal(authorizeUrl.origin + authorizeUrl.pathname, demo.identityProviderConfig.singleSignOnUrl);
    assert.ok(authorizeUrl.searchParams.get("SAMLRequest"));
    assert.equal(authorizeUrl.searchParams.get("RelayState"), "/profile");
});

test("IdP 登录页展示解析出来的 AuthnRequest 上下文", async () => {
    const browser = createBrowser();
    const loginPage = await openIdpLoginPage(browser, await startLogin(browser, "/profile"));

    assert.ok(loginPage.html.includes(demo.serviceProviderConfig.entityId));
    assert.equal(loginPage.fields.relayState, "/profile");
    assert.match(loginPage.fields.authnRequestId, /^_[0-9a-f]+$/);
});

test("完整流程：登录成功后 SP 建立会话并展示断言里的用户", async () => {
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

test("RelayState 把用户送回登录前想去的页面", async () => {
    const browser = createBrowser();

    const acsResponse = await runSingleSignOn(browser, { uid: "sakura", returnTo: "/orders/42" });

    assert.equal(acsResponse.headers.get("location"), "/orders/42");
});

test("未登录访问 /profile 会跳回首页", async () => {
    const response = await createBrowser().get(`${serviceProviderBaseUrl}/profile`);

    assert.equal(response.status, 302);
    assert.equal(response.headers.get("location"), "/");
});

test("退出登录后会话失效", async () => {
    const browser = createBrowser();
    await runSingleSignOn(browser, { uid: "hanjin" });

    await browser.postForm(`${serviceProviderBaseUrl}/logout`, {});

    assert.equal(browser.hasCookie(SESSION_COOKIE), false);

    const profile = await browser.get(`${serviceProviderBaseUrl}/profile`);
    assert.equal(profile.headers.get("location"), "/");
});

test("中间人篡改 role 之后，SP 拒绝建立会话", async () => {
    const browser = createBrowser();

    const acsResponse = await runSingleSignOn(browser, { uid: "hanjin", shouldTamper: true });

    assert.equal(acsResponse.status, 400);
    assert.match(await acsResponse.text(), /Invalid signature/);
    assert.equal(browser.hasCookie(SESSION_COOKIE), false);
});

test("重放同一份 SAMLResponse 会被拒绝", async () => {
    const browser = createBrowser();
    const autoPostForm = await issueSamlResponse(browser, { uid: "hanjin" });

    const firstAttempt = await browser.postForm(autoPostForm.action, autoPostForm.fields);
    assert.equal(firstAttempt.status, 302);

    // InResponseTo 只能兑现一次，重放的 Assertion 对不上任何未完成的 AuthnRequest。
    const replay = await createBrowser().postForm(autoPostForm.action, autoPostForm.fields);

    assert.equal(replay.status, 400);
    assert.match(await replay.text(), /InResponseTo/i);
});

/*
 * 下面是把浏览器行为拆成的四步，顺序与 README 的时序图一致。
 */

async function startLogin(browser, returnTo) {
    const response = await browser.get(
        `${serviceProviderBaseUrl}/login?returnTo=${encodeURIComponent(returnTo)}`,
    );

    assert.equal(response.status, 302, "GET /login 应该重定向到 IdP");

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
