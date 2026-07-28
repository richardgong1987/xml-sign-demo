"use strict";

const express = require("express");
const cookieParser = require("cookie-parser");

const { createHttpErrorHandler } = require("../../shared/http-error-handler");
const { StartSingleSignOnUseCase } = require("./start-single-sign-on.use-case");
const { CompleteSingleSignOnUseCase } = require("./complete-single-sign-on.use-case");
const { createNodeSamlGateway } = require("./node-saml.gateway");
const { createInMemorySessionStore } = require("./in-memory-session-store");
const { createServiceProviderRouter } = require("./sp.controller");

/**
 * SP 这个 feature 的组装点。
 *
 * @param {{
 *   config: object,
 *   identityProvider: { entityId: string, singleSignOnUrl: string, signingCertificatePem: string },
 * }} params
 */
function createServiceProviderApp({ config, identityProvider }) {
    const samlGateway = createNodeSamlGateway({ serviceProvider: config, identityProvider });
    const sessionStore = createInMemorySessionStore();

    const app = express();

    app.use(express.urlencoded({ extended: false }));
    app.use(cookieParser());
    app.use(
        createServiceProviderRouter({
            startSingleSignOn: new StartSingleSignOnUseCase({ samlGateway }),
            completeSingleSignOn: new CompleteSingleSignOnUseCase({ samlGateway, sessionStore }),
            sessionStore,
            metadataXml: samlGateway.describeMetadata(),
        }),
    );
    app.use(createHttpErrorHandler("SP"));

    return app;
}

module.exports = { createServiceProviderApp };
