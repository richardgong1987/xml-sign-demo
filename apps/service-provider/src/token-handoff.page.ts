import {CompletedSingleSignOn} from "./services/complete-single-sign-on.use-case";
import {ACCESS_TOKEN_KEY} from "./access-token-storage";

/*
 * The IdP POSTs to the ACS from *its* origin, so that response cannot reach this
 * origin's localStorage. This page can: it is served by the SP, so its script runs with
 * the SP's storage.
 *
 * The token stays in the response body rather than in a redirect URL — a Location
 * header is exactly the sort of thing proxies and access logs keep.
 *
 * Markup as a string rather than a React component because Next refuses to let a route
 * handler import react-dom/server, and this document is deliberately outside the app's
 * layout: it is visible for a few milliseconds and must not wait on a bundle.
 */
const STYLE = "body{font-family:system-ui,sans-serif;max-width:44rem;margin:3rem auto;padding:0 1rem;line-height:1.7}";

const SCRIPT = `
    const handoff = document.getElementById("token-handoff").dataset;
    localStorage.setItem(${JSON.stringify(ACCESS_TOKEN_KEY)}, handoff.accessToken);
    location.replace(handoff.returnTo);
`;

export function renderTokenHandoffPage({accessToken, returnTo}: CompletedSingleSignOn): string {
    return `<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <title>Signing you in - JSL-online</title>
    <style>${STYLE}</style>
</head>
<body>

<h1>Signing you in&hellip;</h1>

<p>The assertion checked out. Storing this SP's own access token, then continuing to
    <code>${escapeHtml(returnTo)}</code>.</p>

<div id="token-handoff"
     data-access-token="${escapeHtml(accessToken)}"
     data-return-to="${escapeHtml(returnTo)}"></div>

<noscript>
    <p>JavaScript is required to complete sign-in: the access token has to be stored by
        this page.</p>
</noscript>

<script>${SCRIPT}</script>

</body>
</html>`;
}

const HTML_ENTITIES: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&#34;",
    "'": "&#39;",
};

function escapeHtml(value: string): string {
    return value.replace(/[&<>"']/g, (character) => HTML_ENTITIES[character]);
}
