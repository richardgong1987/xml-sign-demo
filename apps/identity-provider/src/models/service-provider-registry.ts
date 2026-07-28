import {Inject, Injectable} from "@nestjs/common";

import {
    IDENTITY_PROVIDER_CONFIG,
    IdentityProviderConfig,
    RegisteredServiceProvider,
} from "../identity-provider.config";

export class UnregisteredServiceProviderError extends Error {
    constructor(entityId: string) {
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
@Injectable()
export class ServiceProviderRegistry {
    private readonly byEntityId: Map<string, RegisteredServiceProvider>;

    constructor(@Inject(IDENTITY_PROVIDER_CONFIG) config: IdentityProviderConfig) {
        this.byEntityId = new Map(
            config.registeredServiceProviders.map((serviceProvider) => [
                serviceProvider.entityId,
                serviceProvider,
            ]),
        );
    }

    find(entityId: string): RegisteredServiceProvider {
        const serviceProvider = this.byEntityId.get(entityId);

        if (!serviceProvider) {
            throw new UnregisteredServiceProviderError(entityId);
        }

        return serviceProvider;
    }
}
