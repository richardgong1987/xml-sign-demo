import { DynamicModule, Module } from "@nestjs/common";

import { SERVICE_PROVIDER_CONFIG, ServiceProviderConfig } from "../config/saml.config";
import {
    SERVICE_PROVIDER_METADATA,
    ServiceProviderController,
} from "./controllers/service-provider.controller";
import { IDENTITY_PROVIDER_TRUST, fetchIdentityProviderTrust } from "./services/idp-metadata.client";
import { NodeSamlGateway } from "./services/node-saml.gateway";
import { SamlGateway } from "./services/saml-gateway";
import { CompleteSingleSignOnUseCase } from "./services/complete-single-sign-on.use-case";
import { StartSingleSignOnUseCase } from "./services/start-single-sign-on.use-case";
import { InMemorySessionStore, SessionStore } from "./services/session-store";

/**
 * JSL-online as a Nest module.
 *
 * IDENTITY_PROVIDER_TRUST is an async provider: the module does not finish
 * initialising until the IdP metadata has been fetched and the signing certificate is
 * in hand. That ordering is the trust-establishment order and is the point of the demo.
 */
@Module({})
export class ServiceProviderModule {
    static register(config: ServiceProviderConfig): DynamicModule {
        return {
            module: ServiceProviderModule,
            controllers: [ServiceProviderController],
            providers: [
                { provide: SERVICE_PROVIDER_CONFIG, useValue: config },
                {
                    provide: IDENTITY_PROVIDER_TRUST,
                    useFactory: () => fetchIdentityProviderTrust(config.identityProviderMetadataUrl),
                },

                StartSingleSignOnUseCase,
                CompleteSingleSignOnUseCase,

                { provide: SamlGateway, useClass: NodeSamlGateway },
                { provide: SessionStore, useClass: InMemorySessionStore },
                {
                    provide: SERVICE_PROVIDER_METADATA,
                    useFactory: (gateway: SamlGateway) => gateway.describeMetadata(),
                    inject: [SamlGateway],
                },
            ],
        };
    }
}
