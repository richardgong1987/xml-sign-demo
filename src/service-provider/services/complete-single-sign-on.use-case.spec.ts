import {Test} from "@nestjs/testing";

import {AuthenticatedUser} from "../models/authenticated-user";
import {AccessTokenIssuer} from "./access-token";
import {CompleteSingleSignOnUseCase} from "./complete-single-sign-on.use-case";
import {SamlGateway} from "./saml-gateway";

const AUTHENTICATED_USER: AuthenticatedUser = {
    nameId: "hanjin",
    uid: "hanjin",
    email: "hanjin@example.test",
    role: "trader",
    sessionIndex: "_session-1",
};

/*
 * A fake SamlGateway that can be told to accept or reject, so "what happens on an
 * invalid signature" needs no forged XML signature.
 */
class StubSamlGateway extends SamlGateway {
    constructor(private readonly rejectionReason?: string) {
        super();
    }

    async createLoginRedirectUrl(): Promise<string> {
        throw new Error("not used in this test");
    }

    async validateSamlResponse(): Promise<AuthenticatedUser> {
        if (this.rejectionReason) {
            throw new Error(this.rejectionReason);
        }

        return AUTHENTICATED_USER;
    }

    describeMetadata(): string {
        throw new Error("not used in this test");
    }
}

/*
 * A fake AccessTokenIssuer: it records who it was asked to mint a token for and signs
 * nothing, so the use case can be tested without any key material.
 */
class RecordingAccessTokenIssuer extends AccessTokenIssuer {
    readonly issuedFor: AuthenticatedUser[] = [];

    issue(user: AuthenticatedUser): string {
        this.issuedFor.push(user);
        return `token-${this.issuedFor.length}`;
    }

    verify(): AuthenticatedUser {
        throw new Error("not used in this test");
    }
}

async function createUseCase(rejectionReason?: string) {
    const accessTokens = new RecordingAccessTokenIssuer();
    const moduleRef = await Test.createTestingModule({
        providers: [
            CompleteSingleSignOnUseCase,
            {provide: SamlGateway, useValue: new StubSamlGateway(rejectionReason)},
            {provide: AccessTokenIssuer, useValue: accessTokens},
        ],
    }).compile();

    return {useCase: moduleRef.get(CompleteSingleSignOnUseCase), accessTokens};
}

describe("CompleteSingleSignOnUseCase", () => {
    it("mints an access token for the asserted user once validation succeeds", async () => {
        const {useCase, accessTokens} = await createUseCase();

        const result = await useCase.execute({samlResponse: "base64", relayState: "/profile"});

        expect(accessTokens.issuedFor).toEqual([AUTHENTICATED_USER]);
        expect(result.accessToken).toBe("token-1");
    });

    it("sends the browser back to RelayState when it is a local path", async () => {
        const {useCase} = await createUseCase();

        const result = await useCase.execute({samlResponse: "base64", relayState: "/orders/42"});

        expect(result.returnTo).toBe("/orders/42");
    });

    it.each(["", "https://attacker.example.test", "//attacker.example.test"])(
        "falls back to the default landing page for RelayState %p",
        async (relayState) => {
            const {useCase} = await createUseCase();

            const result = await useCase.execute({samlResponse: "base64", relayState});

            expect(result.returnTo).toBe("/profile");
        },
    );

    it("mints no token when validation fails", async () => {
        const {useCase, accessTokens} = await createUseCase("Invalid signature");

        await expect(
            useCase.execute({samlResponse: "tampered", relayState: "/profile"}),
        ).rejects.toThrow(/Invalid signature/);
        expect(accessTokens.issuedFor).toHaveLength(0);
    });
});
