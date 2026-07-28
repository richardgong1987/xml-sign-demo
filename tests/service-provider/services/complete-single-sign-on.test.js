import test from "node:test";
import assert from "node:assert/strict";

import {
    CompleteSingleSignOnUseCase,
} from "../../../src/service-provider/services/complete-single-sign-on.js";

const AUTHENTICATED_USER = Object.freeze({ nameId: "hanjin", role: "trader" });

/*
 * Fake SamlGatewayPort that can be told to accept or reject, so "what happens on an
 * invalid signature" needs no forged XML signature.
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

test("opens a session for the asserted user once validation succeeds", async () => {
    const { useCase, sessionStore } = createUseCase();

    const result = await useCase.execute({ samlResponse: "base64", relayState: "/profile" });

    assert.deepEqual(sessionStore.createdUsers, [AUTHENTICATED_USER]);
    assert.equal(result.sessionId, "session-1");
});

test("redirects to RelayState when it is a local path", async () => {
    const { useCase } = createUseCase();

    const result = await useCase.execute({ samlResponse: "base64", relayState: "/orders/42" });

    assert.equal(result.returnTo, "/orders/42");
});

test("falls back to the default landing page when RelayState is empty", async () => {
    const { useCase } = createUseCase();

    const result = await useCase.execute({ samlResponse: "base64", relayState: "" });

    assert.equal(result.returnTo, "/profile");
});

test("falls back to the default landing page when RelayState points off-site", async () => {
    const { useCase } = createUseCase();

    for (const relayState of ["https://attacker.example.test", "//attacker.example.test"]) {
        const result = await useCase.execute({ samlResponse: "base64", relayState });

        assert.equal(result.returnTo, "/profile", `RelayState=${relayState} must not be used as a redirect target`);
    }
});

test("opens no session when validation fails", async () => {
    const { useCase, sessionStore } = createUseCase({ rejectionReason: "Invalid signature" });

    await assert.rejects(
        () => useCase.execute({ samlResponse: "tampered", relayState: "/profile" }),
        /Invalid signature/,
    );
    assert.equal(sessionStore.createdUsers.length, 0);
});
