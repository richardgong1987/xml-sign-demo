"use strict";

/*
 * 集成测试：用 fetch 扮演浏览器，走完整的 SP-initiated SSO 流程。
 *
 * 断言两条路径：
 *   1. 正常登录 → SP 建立会话，/profile 显示 IdP 断言里的用户。
 *   2. 中间人篡改 role → SP 拒绝，不建立会话。
 */

const { serviceProviderConfig } = require("../src/config");

const spBaseUrl = `http://localhost:${serviceProviderConfig.port}`;

async function main() {
    await expectSuccessfulLogin();
    await expectTamperedLoginRejected();

    console.log("\n端到端测试通过。");
}

async function expectSuccessfulLogin() {
    const { response, cookie } = await runSingleSignOn({ shouldTamper: false });

    assert(response.status === 302, `ACS 应返回 302，实际 ${response.status}`);
    assert(Boolean(cookie), "ACS 应下发会话 Cookie");

    const profilePage = await fetch(`${spBaseUrl}/profile`, {
        headers: { cookie },
        redirect: "manual",
    });
    const html = await profilePage.text();

    assert(html.includes("登录成功"), "应进入已登录页面");
    assert(html.includes("trader"), "profile 应显示 IdP 断言里的 role=trader");

    console.log("✓ 正常登录：SAMLResponse 校验通过，SP 建立会话");
}

async function expectTamperedLoginRejected() {
    const { response } = await runSingleSignOn({ shouldTamper: true });
    const body = await response.text();

    assert(response.status === 400, `篡改后 ACS 应返回 400，实际 ${response.status}`);
    assert(!response.headers.getSetCookie().length, "篡改后不应下发会话 Cookie");

    console.log("✓ 篡改 role：签名校验失败，SP 拒绝建立会话");
    console.log(`  SP 返回：${body}`);
}

async function runSingleSignOn({ shouldTamper }) {
    const authorizeUrl = await followLoginRedirect();
    const authnRequestContext = await loadIdpLoginPage(authorizeUrl);
    const autoPostForm = await submitIdpLogin({ ...authnRequestContext, shouldTamper });

    const response = await fetch(autoPostForm.action, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams(autoPostForm.fields),
        redirect: "manual",
    });

    return { response, cookie: toCookieHeader(response) };
}

async function followLoginRedirect() {
    const response = await fetch(`${spBaseUrl}/login?returnTo=/profile`, { redirect: "manual" });

    assert(response.status === 302, "GET /login 应重定向到 IdP");

    return response.headers.get("location");
}

async function loadIdpLoginPage(authorizeUrl) {
    const html = await (await fetch(authorizeUrl)).text();

    return {
        loginUrl: new URL("/idp/login", authorizeUrl).toString(),
        fields: readHiddenFields(html),
    };
}

async function submitIdpLogin({ loginUrl, fields, shouldTamper }) {
    const body = new URLSearchParams({ ...fields, uid: "hanjin" });

    if (shouldTamper) {
        body.set("tamper", "on");
    }

    const html = await (
        await fetch(loginUrl, {
            method: "POST",
            headers: { "content-type": "application/x-www-form-urlencoded" },
            body,
        })
    ).text();

    return {
        action: readAttribute(html, /<form id="saml-post-form"[^>]*action="([^"]*)"/),
        fields: readHiddenFields(html),
    };
}

function readHiddenFields(html) {
    const fields = {};

    for (const [, name, value] of html.matchAll(
        /<input type="hidden" name="([^"]+)" value="([^"]*)"/g,
    )) {
        fields[name] = decodeHtmlEntities(value);
    }

    return fields;
}

function readAttribute(html, pattern) {
    const match = html.match(pattern);
    assert(match, `页面中找不到 ${pattern}`);

    return decodeHtmlEntities(match[1]);
}

function decodeHtmlEntities(value) {
    return value
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&amp;/g, "&");
}

function toCookieHeader(response) {
    return response.headers
        .getSetCookie()
        .map((setCookie) => setCookie.split(";")[0])
        .join("; ");
}

function assert(condition, message) {
    if (!condition) {
        throw new Error(message);
    }
}

main().catch((error) => {
    console.error("端到端测试失败：", error.message);
    process.exitCode = 1;
});
