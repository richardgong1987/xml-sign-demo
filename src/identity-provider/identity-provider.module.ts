import { DynamicModule, Module } from "@nestjs/common";

import { IDENTITY_PROVIDER_CONFIG, IdentityProviderConfig } from "../config/saml.config";
import { Clock, SystemClock } from "../shared/clock";
import { SIGNING_CREDENTIAL, SigningCredential } from "../shared/signing-credential";
import {
    IDENTITY_PROVIDER_METADATA,
    IdentityProviderController,
} from "./controllers/identity-provider.controller";
import { createIdentityProviderMetadata } from "./models/idp-metadata.factory";
import { ServiceProviderRegistry } from "./models/service-provider-registry";
import { UserDirectory } from "./models/user-directory";
import { AssertionSigner } from "./services/assertion-signer";
import { AuthnRequestParser } from "./services/authn-request.parser";
import { IssueSamlResponseUseCase } from "./services/issue-saml-response.use-case";
import { XmlCryptoAssertionSigner } from "./services/xml-crypto-assertion-signer";

export interface IdentityProviderModuleOptions {
    readonly config: IdentityProviderConfig;
    readonly signingCredential: SigningCredential;
}

/**
 * Demo OpenAM as a Nest module.
 *
 * This is the one place where a port is bound to an implementation: swap
 * XmlCryptoAssertionSigner or SystemClock here and nothing else changes.
 */
@Module({})
export class IdentityProviderModule {
    static register({ config, signingCredential }: IdentityProviderModuleOptions): DynamicModule {
        return {
            module: IdentityProviderModule,
            controllers: [IdentityProviderController],
            providers: [
                { provide: IDENTITY_PROVIDER_CONFIG, useValue: config },
                { provide: SIGNING_CREDENTIAL, useValue: signingCredential },
                {
                    provide: IDENTITY_PROVIDER_METADATA,
                    useValue: createIdentityProviderMetadata({
                        entityId: config.entityId,
                        singleSignOnUrl: config.singleSignOnUrl,
                        certificatePem: signingCredential.certificatePem,
                    }),
                },

                UserDirectory,
                ServiceProviderRegistry,
                AuthnRequestParser,
                IssueSamlResponseUseCase,

                { provide: AssertionSigner, useClass: XmlCryptoAssertionSigner },
                { provide: Clock, useClass: SystemClock },
            ],
        };
    }
}
