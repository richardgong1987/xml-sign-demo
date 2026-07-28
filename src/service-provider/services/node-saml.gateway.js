import { SAML } from "@node-saml/node-saml";

import { createAuthenticatedUser } from "../models/authenticated-user.js";

/**
 * SamlGatewayPort 的实现，封装 @node-saml/node-saml。
 *
 * node-saml 负责 SAML 协议；它内部再调用 xml-crypto 完成 XML 签名校验。
 * 除了这个文件，SP 的其它代码不认识 node-saml。
 *
 * @param {{
 *   serviceProvider: { entityId: string, assertionConsumerServiceUrl: string, acceptedClockSkewMs: number },
 *   identityProvider: { entityId: string, singleSignOnUrl: string, signingCertificatePem: string },
 * }} params
 */
export function createNodeSamlGateway({ serviceProvider, identityProvider }) {
    const saml = new SAML({
        issuer: serviceProvider.entityId,
        callbackUrl: serviceProvider.assertionConsumerServiceUrl,
        audience: serviceProvider.entityId,

        entryPoint: identityProvider.singleSignOnUrl,
        idpIssuer: identityProvider.entityId,

        /*
         * 信任的根：只有用这张证书对应的私钥签出来的 Assertion 才会被接受。
         * 它来自 IdP metadata，SP 不持有 IdP 私钥。
         */
        idpCert: identityProvider.signingCertificatePem,

        // 本 Demo 只对 Assertion 签名，外层 Response 不签。
        wantAssertionsSigned: true,
        wantAuthnResponseSigned: false,

        // SP-initiated 流程，必须校验 InResponseTo，防止重放别处的 Assertion。
        validateInResponseTo: "always",

        acceptedClockSkewMs: serviceProvider.acceptedClockSkewMs,
        disableRequestedAuthnContext: true,

        // 与 IdP metadata 公布的 NameIDFormat 保持一致，否则 SP metadata 会误导对接方。
        identifierFormat: "urn:oasis:names:tc:SAML:1.1:nameid-format:unspecified",
    });

    return Object.freeze({
        createLoginRedirectUrl(relayState) {
            return saml.getAuthorizeUrlAsync(relayState, undefined, {});
        },

        async validateSamlResponse(samlResponseBase64) {
            const { profile } = await saml.validatePostResponseAsync({
                SAMLResponse: samlResponseBase64,
            });

            return toAuthenticatedUser(profile);
        },

        describeMetadata() {
            return saml.generateServiceProviderMetadata(null, null);
        },
    });
}

/*
 * 边界翻译：node-saml 的 profile 是外部形状，域内只认 AuthenticatedUser。
 */
function toAuthenticatedUser(profile) {
    return createAuthenticatedUser({
        nameId: profile.nameID,
        uid: profile.uid,
        email: profile.email,
        role: profile.role,
        sessionIndex: profile.sessionIndex,
    });
}

