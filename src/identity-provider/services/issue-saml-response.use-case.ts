import {Inject, Injectable} from "@nestjs/common";

import {IDENTITY_PROVIDER_CONFIG, IdentityProviderConfig} from "../../config/saml.config";
import {Clock} from "../../shared/clock";
import {createUnsignedSamlResponse} from "../models/saml-response.factory";
import {ServiceProviderRegistry} from "../models/service-provider-registry";
import {UserDirectory} from "../models/user-directory";
import {AssertionSigner} from "./assertion-signer";

export interface IssueSamlResponseCommand {
    readonly uid: string;
    readonly serviceProviderEntityId: string;
    readonly authnRequestId: string;
}

export interface IssuedSamlResponse {
    readonly assertionConsumerServiceUrl: string;
    readonly samlResponse: string;
}

/**
 * Once a user has authenticated at the IdP, the IdP issues a signed SAMLResponse for
 * the requesting service provider.
 */
@Injectable()
export class IssueSamlResponseUseCase {
    constructor(
        @Inject(IDENTITY_PROVIDER_CONFIG) private readonly config: IdentityProviderConfig,
        private readonly users: UserDirectory,
        private readonly serviceProviders: ServiceProviderRegistry,
        private readonly assertionSigner: AssertionSigner,
        private readonly clock: Clock,
    ) {
    }

    execute(command: IssueSamlResponseCommand): IssuedSamlResponse {
        const user = this.users.find(command.uid);
        const serviceProvider = this.serviceProviders.find(command.serviceProviderEntityId);

        const unsignedSamlResponse = createUnsignedSamlResponse({
            identityProviderEntityId: this.config.entityId,
            serviceProvider,
            user,
            authnRequestId: command.authnRequestId,
            issuedAt: this.clock.now(),
            assertionLifetimeMs: this.config.assertionLifetimeMs,
            acceptedClockSkewMs: this.config.acceptedClockSkewMs,
        });

        return {
            assertionConsumerServiceUrl: serviceProvider.assertionConsumerServiceUrl,
            samlResponse: this.assertionSigner.signAssertion(unsignedSamlResponse),
        };
    }
}
