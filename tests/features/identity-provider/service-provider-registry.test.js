"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
    createServiceProviderRegistry,
    UnregisteredServiceProviderError,
} = require("../../../src/features/identity-provider/service-provider-registry");

const JSL_ONLINE = Object.freeze({
    entityId: "https://jsl-online.example.test/metadata",
    assertionConsumerServiceUrl: "https://jsl-online.example.test/api/saml/acs",
});

test("返回已注册 SP 的投递地址", () => {
    const registry = createServiceProviderRegistry([JSL_ONLINE]);

    assert.equal(
        registry.find(JSL_ONLINE.entityId).assertionConsumerServiceUrl,
        JSL_ONLINE.assertionConsumerServiceUrl,
    );
});

test("未注册的 Entity ID 抛出 UnregisteredServiceProviderError", () => {
    const registry = createServiceProviderRegistry([JSL_ONLINE]);

    assert.throws(
        () => registry.find("https://attacker.example.test/metadata"),
        UnregisteredServiceProviderError,
    );
});
