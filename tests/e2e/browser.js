/**
 * A minimal browser: it keeps cookies but never follows redirects automatically,
 * so every hop of the SSO flow can be asserted on its own.
 */
export function createBrowser() {
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

            // A cookie-clearing response sends an empty value; drop it here too.
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

export function readHiddenFields(html) {
    const fields = {};

    for (const [, name, value] of html.matchAll(
        /<input type="hidden" name="([^"]+)" value="([^"]*)"/g,
    )) {
        fields[name] = decodeHtmlEntities(value);
    }

    return fields;
}

export function readFormAction(html, formId) {
    const match = html.match(new RegExp(`<form id="${RegExp.escape(formId)}"[^>]*action="([^"]*)"`));

    if (!match) {
        throw new Error(`No form with id="${formId}" on the page`);
    }

    return decodeHtmlEntities(match[1]);
}

// EJS's <%= %> encodes " as &#34; and ' as &#39;.
function decodeHtmlEntities(value) {
    return value
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&(?:quot|#34);/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&amp;/g, "&");
}

