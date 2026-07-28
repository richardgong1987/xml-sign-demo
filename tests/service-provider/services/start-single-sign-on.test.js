import test from "node:test";
import assert from "node:assert/strict";

import {
    StartSingleSignOnUseCase,
} from "../../../src/service-provider/services/start-single-sign-on.js";

/*
 * Fake SamlGatewayPort: records the RelayState and builds no real AuthnRequest.
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

test("hands returnTo to the IdP as RelayState", async () => {
    const samlGateway = createRecordingSamlGateway();
    const useCase = new StartSingleSignOnUseCase({ samlGateway });

    const redirectUrl = await useCase.execute({ returnTo: "/profile" });

    assert.deepEqual(samlGateway.relayStates, ["/profile"]);
    assert.equal(redirectUrl, "https://openam.example.test/sso?RelayState=%2Fprofile");
});
