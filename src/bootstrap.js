"use strict";

const express = require("express");
const cookieParser = require("cookie-parser");

const { createSamlConfigs } = require("./config");

const { createServiceProviderRegistry } = require("./models/service-provider-registry");
const { createIdentityProviderMetadata } = require("./models/idp-metadata.factory");

const { IssueSamlResponseUseCase } = require("./services/issue-saml-response");
const { StartSingleSignOnUseCase } = require("./services/start-single-sign-on");
const { CompleteSingleSignOnUseCase } = require("./services/complete-single-sign-on");
const { createXmlCryptoAssertionSigner } = require("./services/xml-crypto-assertion-signer");
const { createNodeSamlGateway } = require("./services/node-saml.gateway");
const { createInMemorySessionStore } = require("./services/in-memory-session-store");
const { fetchIdentityProviderMetadata } = require("./services/idp-metadata.client");

const { createIdentityProviderRouter } = require("./controllers/idp.controller");
const { createServiceProviderRouter } = require("./controllers/sp.controller");

const { createDemoSigningCredential } = require("./utils/demo-signing-credential");
const { createHttpErrorHandler } = require("./utils/http-error-handler");
const { useEjsViews } = require("./utils/view-engine");
const { systemClock } = require("./utils/system-clock");

/**
 * 组装根：启动 IdP 与 SP。
 *
 * 顺序本身就是 SAML 的信任建立顺序：
 *   IdP 先持有私钥并公布 metadata，SP 才能从 metadata 里导入证书。
 *
 * 端到端测试复用这个函数，测的就是真实的装配结果。
 *
 * @param {{ identityProviderPort: number, serviceProviderPort: number }} ports
 */
async function startSamlDemo(ports) {
    const { identityProviderConfig, serviceProviderConfig } = createSamlConfigs(ports);

    const signingCredential = await createDemoSigningCredential("Demo OpenAM Signing");

    const identityProviderServer = await listen(
        createIdentityProviderApp({ config: identityProviderConfig, signingCredential }),
        identityProviderConfig.port,
    );

    const identityProvider = await fetchIdentityProviderMetadata(
        serviceProviderConfig.identityProviderMetadataUrl,
    );

    const serviceProviderServer = await listen(
        createServiceProviderApp({ config: serviceProviderConfig, identityProvider }),
        serviceProviderConfig.port,
    );

    return {
        identityProviderConfig,
        serviceProviderConfig,
        identityProvider,
        async stop() {
            await Promise.all([close(serviceProviderServer), close(identityProviderServer)]);
        },
    };
}

/*
 * 下面两个函数是唯一把 service 换成具体实现的地方。
 * 想把内存会话换成 Redis、把 xml-crypto 换成别的签名库，只改这里。
 */

function createIdentityProviderApp({ config, signingCredential }) {
    const issueSamlResponse = new IssueSamlResponseUseCase({
        identityProvider: config,
        serviceProviderRegistry: createServiceProviderRegistry(config.registeredServiceProviders),
        assertionSigner: createXmlCryptoAssertionSigner(signingCredential.privateKeyPem),
        clock: systemClock,
    });

    const app = express();

    useEjsViews(app);
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

function createServiceProviderApp({ config, identityProvider }) {
    const samlGateway = createNodeSamlGateway({ serviceProvider: config, identityProvider });
    const sessionStore = createInMemorySessionStore();

    const app = express();

    useEjsViews(app);
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

function listen(app, port) {
    return new Promise((resolve, reject) => {
        const server = app.listen(port, () => resolve(server));
        server.on("error", reject);
    });
}

function close(server) {
    return new Promise((resolve) => server.close(resolve));
}

module.exports = { startSamlDemo };
