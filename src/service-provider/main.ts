import path from "node:path";
import {parseArgs, styleText} from "node:util";
import cookieParser from "cookie-parser";

import {createWebApplication} from "../shared/create-web-application";
import {
    DEFAULT_IDENTITY_PROVIDER_BASE_URL,
    DEFAULT_SERVICE_PROVIDER_PORT,
    ServiceProviderConfig,
    createServiceProviderConfig,
} from "./service-provider.config";
import {ServiceProviderModule} from "./service-provider.module";

/**
 * JSL-online, started on its own.
 *
 *   npm run start:sp
 *   npm run start:sp -- --port 3001 --idp-url http://localhost:4001
 *
 * The SP imports the IdP's signing certificate while its module initialises, so the IdP
 * has to be reachable first. Starting it before the IdP fails with a clear message
 * rather than starting into a half-configured state.
 */
async function main(): Promise<void> {
    const config = createServiceProviderConfig(readOptionsFromCommandLine());

    const app = await createWebApplication({
        module: ServiceProviderModule.register(config),
        viewsDir: path.join(__dirname, "views"),
        serviceName: "SP",
        configure: (application) => application.use(cookieParser()),
    });

    await app.listen(config.port);

    console.log(renderStartupBanner(config));
}

function readOptionsFromCommandLine() {
    const {values} = parseArgs({
        options: {
            port: {type: "string"},
            "idp-url": {type: "string"},
        },
    });

    return {
        port: Number(values.port ?? DEFAULT_SERVICE_PROVIDER_PORT),
        identityProviderBaseUrl: values["idp-url"] ?? DEFAULT_IDENTITY_PROVIDER_BASE_URL,
    };
}

function renderStartupBanner(config: ServiceProviderConfig): string {
    const baseUrl = `http://localhost:${config.port}`;

    return [
        `${styleText("bold", "SP (JSL-online)")}  ${styleText("cyan", baseUrl)}`,
        route("GET ", "/login", "starts SSO"),
        route("GET ", "/api/saml/metadata", "SP metadata"),
        route("POST", "/api/saml/acs", "validates the SAMLResponse, opens a session"),
        route("GET ", "/profile", "shows the signed-in user"),
        "",
        `Signing certificate imported from ${styleText("dim", config.identityProviderMetadataUrl)}`,
        "",
        `Open ${styleText(["cyan", "underline"], baseUrl)} to start.`,
    ].join("\n");
}

function route(method: string, urlPath: string, description: string): string {
    return `  ${styleText("green", method)} ${urlPath.padEnd(22)} ${styleText("dim", description)}`;
}

void main();
