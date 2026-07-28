import path from "node:path";
import express from "express";

import { createServiceProviderRegistry } from "./models/service-provider-registry.js";
import { createIdentityProviderMetadata } from "./models/idp-metadata.factory.js";
import { IssueSamlResponseUseCase } from "./services/issue-saml-response.js";
import { createXmlCryptoAssertionSigner } from "./services/xml-crypto-assertion-signer.js";
import { createIdentityProviderRouter } from "./controllers/idp.controller.js";

import { systemClock } from "../shared/utils/system-clock.js";
import { useEjsViews } from "../shared/utils/view-engine.js";
import { createHttpErrorHandler } from "../shared/utils/http-error-handler.js";

/**
 * Wiring point for the IdP project: here, and only here, the ports a use case
 * depends on are bound to concrete implementations.
 *
 * @param {{ config: object, signingCredential: { privateKeyPem: string, certificatePem: string } }} params
 */
export function createIdentityProviderApp({ config, signingCredential }) {
    const issueSamlResponse = new IssueSamlResponseUseCase({
        identityProvider: config,
        serviceProviderRegistry: createServiceProviderRegistry(config.registeredServiceProviders),
        assertionSigner: createXmlCryptoAssertionSigner(signingCredential.privateKeyPem),
        clock: systemClock,
    });

    const app = express();

    useEjsViews(app, path.join(import.meta.dirname, "views"));
    app.use(express.urlencoded({ extended: false }));
    app.use(
        createIdentityProviderRouter({
            issueSamlResponse,
            metadataXml: createIdentityProviderMetadata({
                entityId: config.entityId,
                singleSignOnUrl: config.singleSignOnUrl,
                certificatePem: signingCredential.certificatePem,
            }),
        }),
    );
    app.use(createHttpErrorHandler("IdP"));

    return app;
}

