import {SAML} from "@node-saml/node-saml";

import {ServiceProviderConfig} from "../config/service-provider.config";
import {AuthenticatedUser, createAuthenticatedUser} from "../domain/authenticated-user";
import {IdentityProviderTrust} from "./idp-metadata.client";
import {SamlGateway} from "./saml-gateway";

/**
 * The SamlGateway implementation, wrapping @node-saml/node-saml.
 *
 * node-saml owns the SAML protocol and internally calls xml-crypto to verify the XML
 * signature. No other file on the SP side knows node-saml exists.
 */
export function createNodeSamlGateway(
    config: ServiceProviderConfig,
    identityProvider: IdentityProviderTrust,
): SamlGateway {
    const saml = new SAML({
        issuer: config.entityId,
        callbackUrl: config.assertionConsumerServiceUrl,
        audience: config.entityId,

        entryPoint: identityProvider.singleSignOnUrl,
        idpIssuer: identityProvider.entityId,

        /*
         * The root of trust: only assertions signed with the private key matching this
         * certificate are accepted. It came from the IdP metadata; the SP never holds
         * the IdP private key.
         */
        idpCert: identityProvider.signingCertificatePem,

        // This demo signs the assertion only, not the enclosing response.
        wantAssertionsSigned: true,
        wantAuthnResponseSigned: false,

        // SP-initiated flow, so InResponseTo must be checked to block replayed assertions.
        validateInResponseTo: "always" as never,

        acceptedClockSkewMs: config.acceptedClockSkewMs,
        disableRequestedAuthnContext: true,

        // Match the NameIDFormat the IdP metadata advertises, or the SP metadata would
        // mislead whoever integrates with it.
        identifierFormat: "urn:oasis:names:tc:SAML:1.1:nameid-format:unspecified",
    });

    return {
        createLoginRedirectUrl(relayState: string): Promise<string> {
            return saml.getAuthorizeUrlAsync(relayState, undefined, {});
        },

        async validateSamlResponse(samlResponseBase64: string): Promise<AuthenticatedUser> {
            const {profile} = await saml.validatePostResponseAsync({SAMLResponse: samlResponseBase64});

            return toAuthenticatedUser(profile);
        },

        describeMetadata(): string {
            return saml.generateServiceProviderMetadata(null, null);
        },
    };
}

/*
 * Boundary translation: node-saml's profile is an external shape; inside the SP only
 * AuthenticatedUser exists.
 */
function toAuthenticatedUser(profile: Record<string, unknown> | null | undefined): AuthenticatedUser {
    return createAuthenticatedUser({
        nameId: String(profile?.nameID ?? ""),
        uid: String(profile?.uid ?? ""),
        email: String(profile?.email ?? ""),
        role: String(profile?.role ?? ""),
    });
}
