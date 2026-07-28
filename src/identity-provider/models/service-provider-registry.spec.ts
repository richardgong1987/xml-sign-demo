import {Test} from "@nestjs/testing";

import {
    DEFAULT_IDENTITY_PROVIDER_PORT,
    DEFAULT_SERVICE_PROVIDER_BASE_URLS,
    IDENTITY_PROVIDER_CONFIG,
    createIdentityProviderConfig,
} from "../identity-provider.config";
import {ServiceProviderRegistry, UnregisteredServiceProviderError} from "./service-provider-registry";

const identityProviderConfig = createIdentityProviderConfig({
    port: DEFAULT_IDENTITY_PROVIDER_PORT,
    serviceProviderBaseUrls: DEFAULT_SERVICE_PROVIDER_BASE_URLS,
});
const JSL_ONLINE = identityProviderConfig.registeredServiceProviders[0];

describe("ServiceProviderRegistry", () => {
    let registry: ServiceProviderRegistry;

    beforeEach(async () => {
        const moduleRef = await Test.createTestingModule({
            providers: [
                ServiceProviderRegistry,
                {provide: IDENTITY_PROVIDER_CONFIG, useValue: identityProviderConfig},
            ],
        }).compile();

        registry = moduleRef.get(ServiceProviderRegistry);
    });

    it("returns the delivery address of a registered SP", () => {
        expect(registry.find(JSL_ONLINE.entityId).assertionConsumerServiceUrl).toBe(
            JSL_ONLINE.assertionConsumerServiceUrl,
        );
    });

    it("throws UnregisteredServiceProviderError for an unregistered entity ID", () => {
        expect(() => registry.find("https://attacker.example.test/metadata")).toThrow(
            UnregisteredServiceProviderError,
        );
    });
});
