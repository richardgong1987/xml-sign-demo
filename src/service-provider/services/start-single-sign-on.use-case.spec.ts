import { Test } from "@nestjs/testing";

import { AuthenticatedUser } from "../models/authenticated-user";
import { SamlGateway } from "./saml-gateway";
import { StartSingleSignOnUseCase } from "./start-single-sign-on.use-case";

/*
 * A fake SamlGateway: it records the RelayState and builds no real AuthnRequest.
 */
class RecordingSamlGateway extends SamlGateway {
    readonly relayStates: string[] = [];

    async createLoginRedirectUrl(relayState: string): Promise<string> {
        this.relayStates.push(relayState);
        return `https://openam.example.test/sso?RelayState=${encodeURIComponent(relayState)}`;
    }

    async validateSamlResponse(): Promise<AuthenticatedUser> {
        throw new Error("not used in this test");
    }

    describeMetadata(): string {
        throw new Error("not used in this test");
    }
}

describe("StartSingleSignOnUseCase", () => {
    it("hands returnTo to the IdP as RelayState", async () => {
        const samlGateway = new RecordingSamlGateway();
        const moduleRef = await Test.createTestingModule({
            providers: [StartSingleSignOnUseCase, { provide: SamlGateway, useValue: samlGateway }],
        }).compile();

        const redirectUrl = await moduleRef.get(StartSingleSignOnUseCase).execute({
            returnTo: "/profile",
        });

        expect(samlGateway.relayStates).toEqual(["/profile"]);
        expect(redirectUrl).toBe("https://openam.example.test/sso?RelayState=%2Fprofile");
    });
});
