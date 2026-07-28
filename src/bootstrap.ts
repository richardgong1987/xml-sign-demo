import path from "node:path";
import { INestApplication } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { NestExpressApplication } from "@nestjs/platform-express";
import cookieParser from "cookie-parser";

import {
    IdentityProviderConfig,
    SamlPorts,
    ServiceProviderConfig,
    createSamlConfigs,
} from "./config/saml.config";
import { IdentityProviderModule } from "./identity-provider/identity-provider.module";
import { ServiceProviderModule } from "./service-provider/service-provider.module";
import {
    IDENTITY_PROVIDER_TRUST,
    IdentityProviderTrust,
} from "./service-provider/services/idp-metadata.client";
import { SamlFailureFilter } from "./shared/saml-failure.filter";
import { createDemoSigningCredential } from "./shared/signing-credential";
import { configureWebLayer } from "./shared/web-layer";

export interface RunningSamlDemo {
    readonly identityProviderConfig: IdentityProviderConfig;
    readonly serviceProviderConfig: ServiceProviderConfig;
    readonly identityProvider: IdentityProviderTrust;
    stop(): Promise<void>;
}

/**
 * Starts both applications.
 *
 * The order is the trust-establishment order itself: the IdP must be listening and
 * publishing its metadata before the SP module can resolve IDENTITY_PROVIDER_TRUST.
 *
 * The end-to-end suite calls this too, so it exercises the real wiring.
 */
export async function startSamlDemo(ports: SamlPorts): Promise<RunningSamlDemo> {
    const { identityProviderConfig, serviceProviderConfig } = createSamlConfigs(ports);

    const signingCredential = await createDemoSigningCredential("Demo OpenAM Signing");

    const identityProvider = await createApp({
        module: IdentityProviderModule.register({ config: identityProviderConfig, signingCredential }),
        viewsDir: path.join(__dirname, "identity-provider", "views"),
        serviceName: "IdP",
    });
    await identityProvider.listen(identityProviderConfig.port);

    const serviceProvider = await createApp({
        module: ServiceProviderModule.register(serviceProviderConfig),
        viewsDir: path.join(__dirname, "service-provider", "views"),
        serviceName: "SP",
        configure: (app) => app.use(cookieParser()),
    });
    await serviceProvider.listen(serviceProviderConfig.port);

    return {
        identityProviderConfig,
        serviceProviderConfig,
        // The trust the SP imported, exposed so the e2e suite can assert on it.
        identityProvider: serviceProvider.get<IdentityProviderTrust>(IDENTITY_PROVIDER_TRUST),
        async stop() {
            await Promise.all([serviceProvider.close(), identityProvider.close()]);
        },
    };
}

async function createApp(options: {
    module: Parameters<typeof NestFactory.create>[0];
    viewsDir: string;
    serviceName: string;
    configure?: (app: NestExpressApplication) => void;
}): Promise<NestExpressApplication & INestApplication> {
    const app = await NestFactory.create<NestExpressApplication>(options.module, {
        logger: ["error", "warn"],
    });

    configureWebLayer(app, options.viewsDir);
    app.useGlobalFilters(new SamlFailureFilter(options.serviceName));
    options.configure?.(app);

    return app;
}
