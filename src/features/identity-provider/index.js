"use strict";

const path = require("node:path");
const express = require("express");

const { STATIC_ASSETS_DIR } = require("../../shared/static-assets");
const { useEjsViews } = require("../../shared/view-engine");
const { systemClock } = require("../../shared/system-clock");
const { createHttpErrorHandler } = require("../../shared/http-error-handler");
const { createServiceProviderRegistry } = require("./service-provider-registry");
const { IssueSamlResponseUseCase } = require("./issue-saml-response.use-case");
const { createXmlCryptoAssertionSigner } = require("./xml-crypto-assertion-signer");
const { createIdentityProviderMetadata } = require("./idp-metadata.factory");
const { createIdentityProviderRouter } = require("./idp.controller");

/**
 * IdP 这个 feature 的组装点：在这里，也只在这里，
 * 把 use case 需要的 port 换成具体实现。
 *
 * @param {{ config: object, signingCredential: { privateKeyPem: string, certificatePem: string } }} params
 */
function createIdentityProviderApp({ config, signingCredential }) {
    const issueSamlResponse = new IssueSamlResponseUseCase({
        identityProvider: config,
        serviceProviderRegistry: createServiceProviderRegistry(config.registeredServiceProviders),
        assertionSigner: createXmlCryptoAssertionSigner(signingCredential.privateKeyPem),
        clock: systemClock,
    });

    const app = express();

    useEjsViews(app, path.join(__dirname, "views"));

    app.use(express.static(STATIC_ASSETS_DIR));
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

module.exports = { createIdentityProviderApp };
