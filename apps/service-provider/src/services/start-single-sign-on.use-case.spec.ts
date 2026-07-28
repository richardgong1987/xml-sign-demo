import {AuthenticatedUser} from "../domain/authenticated-user";
import {SamlGateway} from "./saml-gateway";
import {StartSingleSignOnUseCase} from "./start-single-sign-on.use-case";

/*
 * A fake SamlGateway: it records the RelayState and builds no real AuthnRequest.
 * With the DI container gone, a fake is just an object literal.
 */
function createRecordingSamlGateway() {
    const relayStates: string[] = [];

    const gateway: SamlGateway = {
        async createLoginRedirectUrl(relayState) {
            relayStates.push(relayState);
            return `https://openam.example.test/sso?RelayState=${encodeURIComponent(relayState)}`;
        },
        validateSamlResponse(): Promise<AuthenticatedUser> {
            throw new Error("not used in this test");
        },
        describeMetadata(): string {
            throw new Error("not used in this test");
        },
    };

    return {gateway, relayStates};
}

describe("StartSingleSignOnUseCase", () => {
    it("hands returnTo to the IdP as RelayState", async () => {
        const {gateway, relayStates} = createRecordingSamlGateway();

        const redirectUrl = await new StartSingleSignOnUseCase(gateway).execute({returnTo: "/profile"});

        expect(relayStates).toEqual(["/profile"]);
        expect(redirectUrl).toBe("https://openam.example.test/sso?RelayState=%2Fprofile");
    });
});
