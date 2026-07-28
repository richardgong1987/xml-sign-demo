/*
 * The SP's own configuration. All it needs to know about the IdP is where to read its
 * metadata; the SSO endpoint and the signing certificate are imported from there.
 */

export interface ServiceProviderConfig {
    readonly port: number;
    readonly entityId: string;
    readonly assertionConsumerServiceUrl: string;
    readonly identityProviderMetadataUrl: string;
    readonly acceptedClockSkewMs: number;
}

/*
 * An interface vanishes at runtime, so Nest cannot use it as an injection token.
 * This symbol stands in for it.
 */
export const SERVICE_PROVIDER_CONFIG = Symbol("ServiceProviderConfig");

export const DEFAULT_SERVICE_PROVIDER_PORT = 3000;
export const DEFAULT_IDENTITY_PROVIDER_BASE_URL = "http://localhost:4000";

export interface ServiceProviderOptions {
    readonly port: number;
    /** Where the IdP publishes its metadata; the only address the SP is told. */
    readonly identityProviderBaseUrl: string;
}

export function createServiceProviderConfig(options: ServiceProviderOptions): ServiceProviderConfig {
    const baseUrl = `http://localhost:${options.port}`;

    return Object.freeze({
        port: options.port,
        entityId: `${baseUrl}/api/saml/metadata`,
        assertionConsumerServiceUrl: `${baseUrl}/api/saml/acs`,

        identityProviderMetadataUrl: `${options.identityProviderBaseUrl}/idp/metadata`,

        acceptedClockSkewMs: 5_000,
    });
}
