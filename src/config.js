"use strict";

/*
 * 配置属于最外层。domain 和 use case 不读环境变量，也不认识端口号，
 * 只接收由组装根传进去的值。
 *
 * 端口做成参数而不是常量，是因为 Entity ID 和各个地址都从端口推导出来：
 * 测试要在另一组端口上启动同一套服务，就必须能整组重算。
 */

const DEFAULT_PORTS = Object.freeze({
    identityProviderPort: 4000,
    serviceProviderPort: 5000,
});

function createSamlConfigs({ identityProviderPort, serviceProviderPort }) {
    const identityProviderBaseUrl = `http://localhost:${identityProviderPort}`;
    const serviceProviderBaseUrl = `http://localhost:${serviceProviderPort}`;

    const serviceProviderConfig = Object.freeze({
        port: serviceProviderPort,
        entityId: `${serviceProviderBaseUrl}/api/saml/metadata`,
        assertionConsumerServiceUrl: `${serviceProviderBaseUrl}/api/saml/acs`,

        // SP 不硬编码 IdP 的 SSO 地址和证书，启动时从这份 metadata 导入。
        identityProviderMetadataUrl: `${identityProviderBaseUrl}/idp/metadata`,

        acceptedClockSkewMs: 5_000,
    });

    const identityProviderConfig = Object.freeze({
        port: identityProviderPort,
        entityId: `${identityProviderBaseUrl}/idp/metadata`,
        singleSignOnUrl: `${identityProviderBaseUrl}/idp/sso`,

        assertionLifetimeMs: 5 * 60_000,
        acceptedClockSkewMs: 5_000,

        /*
         * IdP 只为注册过的 SP 签发 Assertion。
         * ACS 地址以这份注册表为准，不采用 AuthnRequest 里带来的地址。
         */
        registeredServiceProviders: Object.freeze([
            Object.freeze({
                entityId: serviceProviderConfig.entityId,
                assertionConsumerServiceUrl: serviceProviderConfig.assertionConsumerServiceUrl,
            }),
        ]),
    });

    return { identityProviderConfig, serviceProviderConfig };
}

module.exports = { createSamlConfigs, DEFAULT_PORTS };
