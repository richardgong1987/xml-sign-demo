export class UnregisteredServiceProviderError extends Error {
    constructor(entityId) {
        super(`The IdP has no registration for this SP: ${entityId}`);
        this.name = "UnregisteredServiceProviderError";
    }
}

/**
 * The service providers this IdP trusts.
 *
 * This is a security rule, not merely a lookup table: both the assertion's Audience
 * and its delivery address are decided here. Trusting the ACS URL carried in the
 * AuthnRequest instead would let an attacker have the IdP deliver a perfectly valid
 * assertion to a server of their choosing.
 */
export function createServiceProviderRegistry(serviceProviders) {
    const byEntityId = new Map(
        serviceProviders.map((serviceProvider) => [serviceProvider.entityId, serviceProvider]),
    );

    return Object.freeze({
        find(entityId) {
            const serviceProvider = byEntityId.get(entityId);

            if (!serviceProvider) {
                throw new UnregisteredServiceProviderError(entityId);
            }

            return serviceProvider;
        },
    });
}
