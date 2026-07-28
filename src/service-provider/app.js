import path from "node:path";
import express from "express";
import cookieParser from "cookie-parser";

import { StartSingleSignOnUseCase } from "./services/start-single-sign-on.js";
import { CompleteSingleSignOnUseCase } from "./services/complete-single-sign-on.js";
import { createNodeSamlGateway } from "./services/node-saml.gateway.js";
import { createInMemorySessionStore } from "./services/in-memory-session-store.js";
import { createServiceProviderRouter } from "./controllers/sp.controller.js";

import { useEjsViews } from "../shared/utils/view-engine.js";
import { createHttpErrorHandler } from "../shared/utils/http-error-handler.js";

/**
 * SP 这个项目的装配点。
 *
 * @param {{
 *   config: object,
 *   identityProvider: { entityId: string, singleSignOnUrl: string, signingCertificatePem: string },
 * }} params
 */
export function createServiceProviderApp({ config, identityProvider }) {
    const samlGateway = createNodeSamlGateway({ serviceProvider: config, identityProvider });
    const sessionStore = createInMemorySessionStore();

    const app = express();

    useEjsViews(app, path.join(import.meta.dirname, "views"));
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

