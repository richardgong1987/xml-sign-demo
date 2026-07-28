import test from "node:test";
import assert from "node:assert/strict";

import {
    StartSingleSignOnUseCase,
} from "../../../src/service-provider/services/start-single-sign-on.js";

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
