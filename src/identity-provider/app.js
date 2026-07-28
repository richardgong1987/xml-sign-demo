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
 * IdP 这个项目的装配点：在这里，也只在这里，
 * 把用例需要的 port 换成具体实现。
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

