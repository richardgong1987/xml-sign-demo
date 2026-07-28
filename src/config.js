/*
 * Configuration belongs to the outermost layer. Models and use cases read no
 * environment variables and know nothing about port numbers; they only receive
 * what the composition root passes in.
 *
 * Ports are a parameter rather than a constant because every entity ID and URL is
 * derived from them: running the same pair of services on a second set of ports
 * requires recomputing the whole set.
 */

export const DEFAULT_PORTS = Object.freeze({
    identityProviderPort: 4000,
    serviceProviderPort: 5000,
});

export function createSamlConfigs({ identityProviderPort, serviceProviderPort }) {
    const identityProviderBaseUrl = `http://localhost:${identityProviderPort}`;
    const serviceProviderBaseUrl = `http://localhost:${serviceProviderPort}`;

    const serviceProviderConfig = Object.freeze({
        port: serviceProviderPort,
        entityId: `${serviceProviderBaseUrl}/api/saml/metadata`,
        assertionConsumerServiceUrl: `${serviceProviderBaseUrl}/api/saml/acs`,

        // The SP hardcodes neither the IdP's SSO URL nor its certificate; both are
        // imported from this metadata document at startup.
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
