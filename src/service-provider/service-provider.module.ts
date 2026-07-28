import {DynamicModule, Module} from "@nestjs/common";
import {JwtModule} from "@nestjs/jwt";

import {SERVICE_PROVIDER_CONFIG, ServiceProviderConfig} from "./service-provider.config";
import {BearerTokenGuard} from "./controllers/bearer-token.guard";
import {SERVICE_PROVIDER_METADATA, ServiceProviderController,} from "./controllers/service-provider.controller";
import {AccessTokenIssuer} from "./services/access-token";
import {fetchIdentityProviderTrust, IDENTITY_PROVIDER_TRUST} from "./services/idp-metadata.client";
import {JwtAccessTokenIssuer} from "./services/jwt-access-token.issuer";
import {NodeSamlGateway} from "./services/node-saml.gateway";
import {SamlGateway} from "./services/saml-gateway";
import {CompleteSingleSignOnUseCase} from "./services/complete-single-sign-on.use-case";
import {StartSingleSignOnUseCase} from "./services/start-single-sign-on.use-case";

export interface ServiceProviderModuleOptions {
    readonly config: ServiceProviderConfig;
    readonly accessTokenSecret: string;
}

/**
 * JSL-online as a Nest module.
 *
 * IDENTITY_PROVIDER_TRUST is an async provider: the module does not finish
 * initialising until the IdP metadata has been fetched and the signing certificate is
 * in hand. That ordering is the trust-establishment order and is the point of the demo.
 */
@Module({})
export class ServiceProviderModule {
    static register({config, accessTokenSecret}: ServiceProviderModuleOptions): DynamicModule {
        return {
            module: ServiceProviderModule,
            imports: [
                JwtModule.register({
                    secret: accessTokenSecret,
                    signOptions: {algorithm: "HS256"},
                    // Pin the algorithm on the way in as well. Trusting whatever the
                    // token's own header claims is the classic JWT confusion bug.
                    verifyOptions: {algorithms: ["HS256"]},
                }),
            ],
            controllers: [ServiceProviderController],
            providers: [
                {provide: SERVICE_PROVIDER_CONFIG, useValue: config},
                {
                    provide: IDENTITY_PROVIDER_TRUST,
                    useFactory: () => fetchIdentityProviderTrust(config.identityProviderMetadataUrl),
                },

                StartSingleSignOnUseCase,
                CompleteSingleSignOnUseCase,
                BearerTokenGuard,

                {provide: SamlGateway, useClass: NodeSamlGateway},
                {provide: AccessTokenIssuer, useClass: JwtAccessTokenIssuer},
                {
                    provide: SERVICE_PROVIDER_METADATA,
                    useFactory: (gateway: SamlGateway) => gateway.describeMetadata(),
                    inject: [SamlGateway],
                },
            ],
        };
    }
}
