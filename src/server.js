import { parseArgs, styleText } from "node:util";

import { DEFAULT_PORTS } from "./config.js";
import { startSamlDemo } from "./bootstrap.js";

/*
 * ESM supports top-level await, so there is no main() wrapper. A startup failure
 * propagates as an unhandled rejection: Node prints it and exits non-zero.
 */
const demo = await startSamlDemo(readPortsFromCommandLine());

console.log(renderStartupBanner(demo));

/*
 * Ports are already a parameter in config.js, so node:util's parseArgs simply
 * exposes them on the command line:
 *   npm start -- --idp-port 4001 --sp-port 5001
 */
function readPortsFromCommandLine() {
    const { values } = parseArgs({
        options: {
            "idp-port": { type: "string" },
            "sp-port": { type: "string" },
        },
    });

    return {
        identityProviderPort: Number(values["idp-port"] ?? DEFAULT_PORTS.identityProviderPort),
        serviceProviderPort: Number(values["sp-port"] ?? DEFAULT_PORTS.serviceProviderPort),
    };
}

function renderStartupBanner({ identityProviderConfig, serviceProviderConfig, identityProvider }) {
    const idpBaseUrl = `http://localhost:${identityProviderConfig.port}`;
    const spBaseUrl = `http://localhost:${serviceProviderConfig.port}`;

    return [
        heading("IdP (Demo OpenAM)", idpBaseUrl),
        route("GET ", "/idp/metadata", "IdP metadata, including the signing certificate"),
        route("GET ", "/idp/sso", "receives the AuthnRequest, shows the login page"),
        route("POST", "/idp/login", "issues a signed SAMLResponse"),
        "",
        heading("SP (JSL-online)", spBaseUrl),
        route("GET ", "/login", "starts SSO"),
        route("GET ", "/api/saml/metadata", "SP metadata"),
        route("POST", "/api/saml/acs", "validates the SAMLResponse, opens a session"),
        route("GET ", "/profile", "shows the signed-in user"),
        "",
        `The SP imported the IdP signing certificate from ${identityProvider.entityId}`,
        "",
        `Open ${styleText(["cyan", "underline"], spBaseUrl)} to start.`,
    ].join("\n");
}

function heading(name, baseUrl) {
    return `${styleText("bold", name)}  ${styleText("cyan", baseUrl)}`;
}

function route(method, path, description) {
    return `  ${styleText("green", method)} ${path.padEnd(22)} ${styleText("dim", description)}`;
}
