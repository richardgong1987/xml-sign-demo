import path from "node:path";
import {INestApplication} from "@nestjs/common";
import cookieParser from "cookie-parser";

import {
    IdentityProviderConfig,
    createIdentityProviderConfig,
} from "../src/identity-provider/identity-provider.config";
import {IdentityProviderModule} from "../src/identity-provider/identity-provider.module";
import {createDemoSigningCredential} from "../src/identity-provider/services/signing-credential";
import {
    ServiceProviderConfig,
    createServiceProviderConfig,
} from "../src/service-provider/service-provider.config";
import {ServiceProviderModule} from "../src/service-provider/service-provider.module";
import {
    IDENTITY_PROVIDER_TRUST,
    IdentityProviderTrust,
} from "../src/service-provider/services/idp-metadata.client";
import {createWebApplication} from "../src/shared/create-web-application";

export interface RunningApplications {
    readonly identityProviderConfig: IdentityProviderConfig;
    readonly serviceProviderConfig: ServiceProviderConfig;
    /** The trust the SP imported, so a spec can assert the certificate really travelled. */
    readonly identityProviderTrust: IdentityProviderTrust;

    stop(): Promise<void>;
}

/**
 * Test-only orchestration: production starts each application from its own main.ts, but
 * the end-to-end suite needs both in one process.
 *
 * The order matters and is the point of the demo: the SP module cannot finish
 * initialising until the IdP is listening and publishing its metadata.
 */
export async function startBothApplications(ports: {
    identityProviderPort: number;
    serviceProviderPort: number;
}): Promise<RunningApplications> {
    const identityProviderConfig = createIdentityProviderConfig({
        port: ports.identityProviderPort,
        serviceProviderBaseUrls: [`http://localhost:${ports.serviceProviderPort}`],
    });
    const serviceProviderConfig = createServiceProviderConfig({
        port: ports.serviceProviderPort,
        identityProviderBaseUrl: `http://localhost:${ports.identityProviderPort}`,
    });

    const signingCredential = await createDemoSigningCredential("Demo OpenAM Signing");

    const identityProvider = await listen(
        await createWebApplication({
            module: IdentityProviderModule.register({config: identityProviderConfig, signingCredential}),
            viewsDir: path.join(__dirname, "..", "src", "identity-provider", "views"),
            serviceName: "IdP",
        }),
        identityProviderConfig.port,
    );

    const serviceProvider = await listen(
        await createWebApplication({
            module: ServiceProviderModule.register(serviceProviderConfig),
            viewsDir: path.join(__dirname, "..", "src", "service-provider", "views"),
            serviceName: "SP",
            configure: (app) => app.use(cookieParser()),
        }),
        serviceProviderConfig.port,
    );

    return {
        identityProviderConfig,
        serviceProviderConfig,
        identityProviderTrust: serviceProvider.get<IdentityProviderTrust>(IDENTITY_PROVIDER_TRUST),
        async stop() {
            await Promise.all([serviceProvider.close(), identityProvider.close()]);
        },
    };
}

async function listen<T extends INestApplication>(app: T, port: number): Promise<T> {
    await app.listen(port);

    return app;
}
