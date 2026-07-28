/*
 * Configuration belongs to the outermost layer. Models and use cases read no
 * environment variables and know nothing about port numbers; they receive whatever
 * the composition root injects.
 *
 * Ports are a parameter rather than a constant because every entity ID and URL is
 * derived from them: running the same pair of services on a second set of ports
 * requires recomputing the whole set, which is what lets the e2e suite start an
 * isolated pair alongside a running dev server.
 */

export interface SamlPorts {
    readonly identityProviderPort: number;
    readonly serviceProviderPort: number;
}

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

export interface ServiceProviderConfig {
    readonly port: number;
    readonly entityId: string;
    readonly assertionConsumerServiceUrl: string;
    readonly identityProviderMetadataUrl: string;
    readonly acceptedClockSkewMs: number;
}

/*
 * Interfaces vanish at runtime, so Nest cannot use them as injection tokens.
 * These symbols stand in for them.
 */
export const IDENTITY_PROVIDER_CONFIG = Symbol("IdentityProviderConfig");
export const SERVICE_PROVIDER_CONFIG = Symbol("ServiceProviderConfig");

export const DEFAULT_PORTS: SamlPorts = Object.freeze({
    identityProviderPort: 4000,
    serviceProviderPort: 3000,
});

export function createSamlConfigs({ identityProviderPort, serviceProviderPort }: SamlPorts): {
    identityProviderConfig: IdentityProviderConfig;
    serviceProviderConfig: ServiceProviderConfig;
} {
    const identityProviderBaseUrl = `http://localhost:${identityProviderPort}`;
    const serviceProviderBaseUrl = `http://localhost:${serviceProviderPort}`;

    const serviceProviderConfig: ServiceProviderConfig = Object.freeze({
        port: serviceProviderPort,
        entityId: `${serviceProviderBaseUrl}/api/saml/metadata`,
        assertionConsumerServiceUrl: `${serviceProviderBaseUrl}/api/saml/acs`,

        // The SP hardcodes neither the IdP's SSO URL nor its certificate; both are
        // imported from this metadata document while the module initialises.
        identityProviderMetadataUrl: `${identityProviderBaseUrl}/idp/metadata`,

        acceptedClockSkewMs: 5_000,
    });

    const identityProviderConfig: IdentityProviderConfig = Object.freeze({
        port: identityProviderPort,
        entityId: `${identityProviderBaseUrl}/idp/metadata`,
        singleSignOnUrl: `${identityProviderBaseUrl}/idp/sso`,

        assertionLifetimeMs: 5 * 60_000,
        acceptedClockSkewMs: 5_000,

        /*
         * The IdP issues assertions only for service providers it has registered.
         * The ACS URL comes from this registry, never from the AuthnRequest.
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
