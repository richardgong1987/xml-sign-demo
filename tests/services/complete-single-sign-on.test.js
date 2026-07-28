"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
    CompleteSingleSignOnUseCase,
} = require("../../src/services/complete-single-sign-on");

const AUTHENTICATED_USER = Object.freeze({ nameId: "hanjin", role: "trader" });

/*
 * 假的 SamlGatewayPort：可以选择校验通过还是失败，
 * 于是“签名无效时会发生什么”不需要真的伪造一份 XML 签名。
 */
function createStubSamlGateway({ rejectionReason } = {}) {
    return {
        async validateSamlResponse() {
            if (rejectionReason) {
                throw new Error(rejectionReason);
            }

            return AUTHENTICATED_USER;
        },
    };
}

function createRecordingSessionStore() {
    const createdUsers = [];

    return {
        createdUsers,
        create(authenticatedUser) {
            createdUsers.push(authenticatedUser);
            return `session-${createdUsers.length}`;
        },
    };
}

function createUseCase(gatewayOptions) {
    const sessionStore = createRecordingSessionStore();

    return {
        sessionStore,
        useCase: new CompleteSingleSignOnUseCase({
            samlGateway: createStubSamlGateway(gatewayOptions),
            sessionStore,
        }),
    };
}

test("校验通过后为断言里的用户建立会话", async () => {
    const { useCase, sessionStore } = createUseCase();

    const result = await useCase.execute({ samlResponse: "base64", relayState: "/profile" });

    assert.deepEqual(sessionStore.createdUsers, [AUTHENTICATED_USER]);
    assert.equal(result.sessionId, "session-1");
});

test("RelayState 是站内路径时按它跳转", async () => {
    const { useCase } = createUseCase();

    const result = await useCase.execute({ samlResponse: "base64", relayState: "/orders/42" });

    assert.equal(result.returnTo, "/orders/42");
});

test("RelayState 为空时回落到默认页面", async () => {
    const { useCase } = createUseCase();

    const result = await useCase.execute({ samlResponse: "base64", relayState: "" });

    assert.equal(result.returnTo, "/profile");
});

test("RelayState 指向站外时回落到默认页面", async () => {
    const { useCase } = createUseCase();

    for (const relayState of ["https://attacker.example.test", "//attacker.example.test"]) {
        const result = await useCase.execute({ samlResponse: "base64", relayState });

        assert.equal(result.returnTo, "/profile", `RelayState=${relayState} 不应被用作跳转目标`);
    }
});

test("校验失败时不建立会话", async () => {
    const { useCase, sessionStore } = createUseCase({ rejectionReason: "Invalid signature" });

    await assert.rejects(
        () => useCase.execute({ samlResponse: "tampered", relayState: "/profile" }),
        /Invalid signature/,
    );
    assert.equal(sessionStore.createdUsers.length, 0);
});
