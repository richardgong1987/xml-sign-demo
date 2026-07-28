"use strict";

/**
 * 极简浏览器：保存 Cookie，但不自动跟随重定向，
 * 于是 SSO 过程中的每一次跳转都能被单独断言。
 */
function createBrowser() {
    const cookies = new Map();

    async function send(url, options) {
        const response = await fetch(url, {
            ...options,
            redirect: "manual",
            headers: { ...options.headers, ...toCookieHeader() },
        });

        rememberCookies(response);

        return response;
    }

    function toCookieHeader() {
        if (cookies.size === 0) {
            return {};
        }

        return { cookie: [...cookies].map(([name, value]) => `${name}=${value}`).join("; ") };
    }

    function rememberCookies(response) {
        for (const setCookie of response.headers.getSetCookie()) {
            const [name, value] = splitCookiePair(setCookie);

            // 清除 Cookie 的响应把值置空，这里跟着删掉。
            if (value === "") {
                cookies.delete(name);
            } else {
                cookies.set(name, value);
            }
        }
    }

    return {
        get: (url) => send(url, { method: "GET" }),

        postForm: (url, fields) =>
            send(url, {
                method: "POST",
                headers: { "content-type": "application/x-www-form-urlencoded" },
                body: new URLSearchParams(fields),
            }),

        hasCookie: (name) => cookies.has(name),
    };
}

function splitCookiePair(setCookie) {
    const pair = setCookie.split(";")[0];
    const separator = pair.indexOf("=");

    return [pair.slice(0, separator).trim(), pair.slice(separator + 1).trim()];
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

function readFormAction(html, formId) {
    const match = html.match(new RegExp(`<form id="${formId}"[^>]*action="([^"]*)"`));

    if (!match) {
        throw new Error(`页面里找不到 id="${formId}" 的表单`);
    }

    return decodeHtmlEntities(match[1]);
}

// EJS 的 <%= %> 会把 " 转成 &#34;、' 转成 &#39;。
function decodeHtmlEntities(value) {
    return value
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&(?:quot|#34);/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&amp;/g, "&");
}

module.exports = { createBrowser, readHiddenFields, readFormAction };
