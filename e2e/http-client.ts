/*
 * A stand-in for the browser. There is no cookie jar: the SP keeps nothing on the
 * server and the browser carries its access token explicitly, so every authenticated
 * request is just an Authorization header.
 *
 * Redirects are never followed automatically, so each hop can be asserted on its own.
 */

export function get(url: string, accessToken?: string): Promise<Response> {
    return fetch(url, {
        redirect: "manual",
        headers: accessToken ? {authorization: `Bearer ${accessToken}`} : {},
    });
}

export function postForm(url: string, fields: Record<string, string>): Promise<Response> {
    return fetch(url, {
        method: "POST",
        redirect: "manual",
        headers: {"content-type": "application/x-www-form-urlencoded"},
        body: new URLSearchParams(fields),
    });
}

export function readHiddenFields(html: string): Record<string, string> {
    const fields: Record<string, string> = {};

    for (const [, name, value] of html.matchAll(
        /<input type="hidden" name="([^"]+)" value="([^"]*)"/g,
    )) {
        fields[name] = decodeHtmlEntities(value);
    }

    return fields;
}

export function readFormAction(html: string, formId: string): string {
    const match = html.match(new RegExp(`<form id="${RegExp.escape(formId)}"[^>]*action="([^"]*)"`));

    if (!match) {
        throw new Error(`No form with id="${formId}" on the page`);
    }

    return decodeHtmlEntities(match[1]);
}

export interface TokenHandoff {
    readonly accessToken: string;
    readonly returnTo: string;
}

/** Reads what the ACS hand-off page asks the browser to put into localStorage. */
export function readTokenHandoff(html: string): TokenHandoff {
    return {
        accessToken: readDataAttribute(html, "access-token"),
        returnTo: readDataAttribute(html, "return-to"),
    };
}

function readDataAttribute(html: string, attribute: string): string {
    const match = html.match(new RegExp(`data-${RegExp.escape(attribute)}="([^"]*)"`));

    if (!match) {
        throw new Error(`No data-${attribute} on the page`);
    }

    return decodeHtmlEntities(match[1]);
}

// Both EJS and React escape " as &#34; and ' as &#39;.
function decodeHtmlEntities(value: string): string {
    return value
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&(?:quot|#34);/g, '"')
        .replace(/&(?:apos|#39|#x27);/g, "'")
        .replace(/&amp;/g, "&");
}
