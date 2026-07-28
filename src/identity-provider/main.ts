import path from "node:path";
import {parseArgs, styleText} from "node:util";

import {createWebApplication} from "../shared/create-web-application";
import {
    DEFAULT_IDENTITY_PROVIDER_PORT,
    DEFAULT_SERVICE_PROVIDER_BASE_URLS,
    IdentityProviderConfig,
    createIdentityProviderConfig,
} from "./identity-provider.config";
import {IdentityProviderModule} from "./identity-provider.module";
import {createDemoSigningCredential} from "./services/signing-credential";

/**
 * Demo OpenAM, started on its own.
 *
 *   npm run start:idp
 *   npm run start:idp -- --port 4001 --sp-url http://localhost:3001
 *
 * The IdP does not know or care whether an SP is running; it only knows which service
 * providers it has been told to trust.
 */
async function main(): Promise<void> {
    const config = createIdentityProviderConfig(readOptionsFromCommandLine());
    const signingCredential = await createDemoSigningCredential("Demo OpenAM Signing");

    const app = await createWebApplication({
        module: IdentityProviderModule.register({config, signingCredential}),
        viewsDir: path.join(__dirname, "views"),
        serviceName: "IdP",
    });

    await app.listen(config.port);

    console.log(renderStartupBanner(config));
}

function readOptionsFromCommandLine() {
    const {values} = parseArgs({
        options: {
            port: {type: "string"},
            "sp-url": {type: "string", multiple: true},
        },
    });

    return {
        port: Number(values.port ?? DEFAULT_IDENTITY_PROVIDER_PORT),
        serviceProviderBaseUrls: values["sp-url"] ?? DEFAULT_SERVICE_PROVIDER_BASE_URLS,
    };
}

function renderStartupBanner(config: IdentityProviderConfig): string {
    const baseUrl = `http://localhost:${config.port}`;

    return [
        `${styleText("bold", "IdP (Demo OpenAM)")}  ${styleText("cyan", baseUrl)}`,
        route("GET ", "/idp/metadata", "IdP metadata, including the signing certificate"),
        route("GET ", "/idp/sso", "receives the AuthnRequest, shows the login page"),
        route("POST", "/idp/login", "issues a signed SAMLResponse"),
        "",
        "Registered service providers:",
        ...config.registeredServiceProviders.map(
            (serviceProvider) => `  ${styleText("dim", serviceProvider.entityId)}`,
        ),
    ].join("\n");
}

function route(method: string, urlPath: string, description: string): string {
    return `  ${styleText("green", method)} ${urlPath.padEnd(22)} ${styleText("dim", description)}`;
}

void main();
