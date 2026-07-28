import { parseArgs, styleText } from "node:util";

import { startSamlDemo, RunningSamlDemo } from "./bootstrap";
import { DEFAULT_PORTS, SamlPorts } from "./config/saml.config";

async function main(): Promise<void> {
    const demo = await startSamlDemo(readPortsFromCommandLine());

    console.log(renderStartupBanner(demo));
}

/*
 * Ports are already a parameter in saml.config.ts, so node:util's parseArgs simply
 * exposes them on the command line:
 *   npm start -- --idp-port 4001 --sp-port 3001
 */
function readPortsFromCommandLine(): SamlPorts {
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

function renderStartupBanner(demo: RunningSamlDemo): string {
    const idpBaseUrl = `http://localhost:${demo.identityProviderConfig.port}`;
    const spBaseUrl = `http://localhost:${demo.serviceProviderConfig.port}`;

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
        `The SP imported the IdP signing certificate from ${demo.identityProvider.entityId}`,
        "",
        `Open ${styleText(["cyan", "underline"], spBaseUrl)} to start.`,
    ].join("\n");
}

function heading(name: string, baseUrl: string): string {
    return `${styleText("bold", name)}  ${styleText("cyan", baseUrl)}`;
}

function route(method: string, path: string, description: string): string {
    return `  ${styleText("green", method)} ${path.padEnd(22)} ${styleText("dim", description)}`;
}

void main();
