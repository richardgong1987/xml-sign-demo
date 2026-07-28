"use strict";

/*
 * 配置属于最外层。domain 和 use case 不读环境变量，也不认识端口号，
 * 只接收由 server.js 传进去的值。
 */

const IDENTITY_PROVIDER_PORT = 4000;
const SERVICE_PROVIDER_PORT = 5000;

const identityProviderBaseUrl = `http://localhost:${IDENTITY_PROVIDER_PORT}`;
const serviceProviderBaseUrl = `http://localhost:${SERVICE_PROVIDER_PORT}`;

const identityProviderConfig = Object.freeze({
    port: IDENTITY_PROVIDER_PORT,
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
            entityId: `${serviceProviderBaseUrl}/api/saml/metadata`,
            assertionConsumerServiceUrl: `${serviceProviderBaseUrl}/api/saml/acs`,
        }),
    ]),
});

const serviceProviderConfig = Object.freeze({
    port: SERVICE_PROVIDER_PORT,
    entityId: `${serviceProviderBaseUrl}/api/saml/metadata`,
    assertionConsumerServiceUrl: `${serviceProviderBaseUrl}/api/saml/acs`,

    /*
     * SP 不硬编码 IdP 的 SSO 地址和证书，启动时从这份 metadata 导入。
     */
    identityProviderMetadataUrl: `${identityProviderBaseUrl}/idp/metadata`,

    acceptedClockSkewMs: 5_000,
});

module.exports = { identityProviderConfig, serviceProviderConfig };
