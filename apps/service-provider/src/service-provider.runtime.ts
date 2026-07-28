import {readServiceProviderConfig, ServiceProviderConfig} from "./config/service-provider.config";
import {CompleteSingleSignOnUseCase} from "./services/complete-single-sign-on.use-case";
import {fetchIdentityProviderTrust} from "./services/idp-metadata.client";
import {createNodeSamlGateway} from "./services/node-saml.gateway";
import {StartSingleSignOnUseCase} from "./services/start-single-sign-on.use-case";

export interface ServiceProviderRuntime {
    readonly config: ServiceProviderConfig;
    readonly startSingleSignOn: StartSingleSignOnUseCase;
    readonly completeSingleSignOn: CompleteSingleSignOnUseCase;
    readonly samlMetadataXml: string;
}

/*
 * The composition root. Nest had a DI container do this; here it is one function.
 *
 * SamlGateway stays a port because node-saml is heavy to stand up in a test. JWT
 * signing does not: JwtUtil is called statically with config, so there is nothing to
 * inject and nothing to fake.
 *
 * Memoised rather than built at startup because Next gives no reliable "the server is
 * booting" hook — a route handler may be the first thing that runs. The promise is
 * cached, so the IdP metadata is fetched once per process and every later request
 * reuses the same trust.
 */
let runtime: Promise<ServiceProviderRuntime> | undefined;

export function getServiceProvider(): Promise<ServiceProviderRuntime> {
    runtime ??= createServiceProvider();

    return runtime;
}

async function createServiceProvider(): Promise<ServiceProviderRuntime> {
    const config = readServiceProviderConfig();

    // Trust is established here and nowhere else: the certificate arrives over HTTP
    // from the IdP, and the SP never sees the IdP private key.
    const identityProvider = await fetchIdentityProviderTrust(config.identityProviderMetadataUrl);

    const samlGateway = createNodeSamlGateway(config, identityProvider);

    return {
        config,
        startSingleSignOn: new StartSingleSignOnUseCase(samlGateway),
        completeSingleSignOn: new CompleteSingleSignOnUseCase(samlGateway, config),
        samlMetadataXml: samlGateway.describeMetadata(),
    };
}
