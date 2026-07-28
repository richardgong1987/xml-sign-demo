import { SAML } from "@node-saml/node-saml";

import { createAuthenticatedUser } from "../models/authenticated-user.js";

/**
 * SamlGatewayPort implementation wrapping @node-saml/node-saml.
 *
 * node-saml owns the SAML protocol and internally calls xml-crypto to verify the XML
 * signature. No other file on the SP side knows node-saml exists.
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
         * The root of trust: only assertions signed with the private key matching this
         * certificate are accepted. It comes from the IdP metadata; the SP never holds
         * the IdP private key.
         */
        idpCert: identityProvider.signingCertificatePem,

        // This demo signs the assertion only, not the enclosing response.
        wantAssertionsSigned: true,
        wantAuthnResponseSigned: false,

        // SP-initiated flow, so InResponseTo must be checked to block replayed assertions.
        validateInResponseTo: "always",

        acceptedClockSkewMs: serviceProvider.acceptedClockSkewMs,
        disableRequestedAuthnContext: true,

        // Match the NameIDFormat the IdP metadata advertises, or the SP metadata would
        // mislead whoever integrates with it.
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
 * Boundary translation: node-saml's profile is an external shape; inside the SP only
 * AuthenticatedUser exists.
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
