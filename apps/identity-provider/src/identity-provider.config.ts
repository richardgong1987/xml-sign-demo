/*
 * The IdP's own configuration. It knows nothing about how the SP is deployed beyond
 * what an administrator would have registered: the SP's entity ID and where assertions
 * for it may be delivered.
 */

export interface RegisteredServiceProvider {
    readonly entityId: string;
    readonly assertionConsumerServiceUrl: string;
}

export interface IdentityProviderConfig {
    readonly port: number;
    readonly entityId: string;
    readonly singleSignOnUrl: string;
    readonly assertionLifetimeMs: number;
    readonly acceptedClockSkewMs: number;
    readonly registeredServiceProviders: readonly RegisteredServiceProvider[];
}

/*
 * An interface vanishes at runtime, so Nest cannot use it as an injection token.
 * This symbol stands in for it.
 */
export const IDENTITY_PROVIDER_CONFIG = Symbol("IdentityProviderConfig");

export const DEFAULT_IDENTITY_PROVIDER_PORT = 4000;
export const DEFAULT_SERVICE_PROVIDER_BASE_URLS = ["http://localhost:3000"];

export interface IdentityProviderOptions {
    readonly port: number;
    /** Base URLs of the service providers this IdP is willing to issue assertions for. */
    readonly serviceProviderBaseUrls: readonly string[];
}

export function createIdentityProviderConfig(options: IdentityProviderOptions): IdentityProviderConfig {
    const baseUrl = `http://localhost:${options.port}`;

    return Object.freeze({
        port: options.port,
        entityId: `${baseUrl}/idp/metadata`,
        singleSignOnUrl: `${baseUrl}/idp/sso`,

        assertionLifetimeMs: 5 * 60_000,
        acceptedClockSkewMs: 5_000,

        /*
         * The IdP issues assertions only for service providers it has registered, and
         * the ACS URL comes from this registry rather than from the AuthnRequest.
         *
         * In production an administrator imports each SP's metadata document. This demo
         * derives the two URLs from the SP's base URL instead, which is the only thing
         * it has to be told.
         */
        registeredServiceProviders: Object.freeze(
            options.serviceProviderBaseUrls.map((serviceProviderBaseUrl) =>
                Object.freeze({
                    entityId: `${serviceProviderBaseUrl}/api/saml/metadata`,
                    assertionConsumerServiceUrl: `${serviceProviderBaseUrl}/api/saml/acs`,
                }),
            ),
        ),
    });
}
