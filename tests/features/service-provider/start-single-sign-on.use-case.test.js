"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
    StartSingleSignOnUseCase,
} = require("../../../src/features/service-provider/start-single-sign-on.use-case");

/*
 * 假的 SamlGatewayPort：记录 RelayState，不生成真正的 AuthnRequest。
 */
function createRecordingSamlGateway() {
    const relayStates = [];

    return {
        relayStates,
        async createLoginRedirectUrl(relayState) {
            relayStates.push(relayState);
            return `https://openam.example.test/sso?RelayState=${encodeURIComponent(relayState)}`;
        },
    };
}

test("把 returnTo 作为 RelayState 交给 IdP", async () => {
    const samlGateway = createRecordingSamlGateway();
    const useCase = new StartSingleSignOnUseCase({ samlGateway });

    const redirectUrl = await useCase.execute({ returnTo: "/profile" });

    assert.deepEqual(samlGateway.relayStates, ["/profile"]);
    assert.equal(redirectUrl, "https://openam.example.test/sso?RelayState=%2Fprofile");
});
