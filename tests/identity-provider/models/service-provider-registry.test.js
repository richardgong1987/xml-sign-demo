import test from "node:test";
import assert from "node:assert/strict";

import {
    createServiceProviderRegistry,
    UnregisteredServiceProviderError,
} from "../../../src/identity-provider/models/service-provider-registry.js";

const JSL_ONLINE = Object.freeze({
    entityId: "https://jsl-online.example.test/metadata",
    assertionConsumerServiceUrl: "https://jsl-online.example.test/api/saml/acs",
});

test("returns the delivery address of a registered SP", () => {
    const registry = createServiceProviderRegistry([JSL_ONLINE]);

    assert.equal(
        registry.find(JSL_ONLINE.entityId).assertionConsumerServiceUrl,
        JSL_ONLINE.assertionConsumerServiceUrl,
    );
});

test("throws UnregisteredServiceProviderError for an unregistered entity ID", () => {
    const registry = createServiceProviderRegistry([JSL_ONLINE]);

    assert.throws(
        () => registry.find("https://attacker.example.test/metadata"),
        UnregisteredServiceProviderError,
    );
});
