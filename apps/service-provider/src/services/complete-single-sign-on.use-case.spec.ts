import {AuthenticatedUser} from "../domain/authenticated-user";
import {AccessTokenIssuer} from "./access-token";
import {CompleteSingleSignOnUseCase} from "./complete-single-sign-on.use-case";
import {SamlGateway} from "./saml-gateway";

const AUTHENTICATED_USER: AuthenticatedUser = {
    nameId: "xh-gong",
    uid: "xh-gong",
    email: "xh-demo@example.com.jp",
    role: "developer",
    sessionIndex: "_session-1",
};

/*
 * A fake gateway that can be told to accept or reject, so "what happens on an invalid
 * signature" needs no forged XML signature.
 */
function createStubSamlGateway(rejectionReason?: string): SamlGateway {
    return {
        createLoginRedirectUrl(): Promise<string> {
            throw new Error("not used in this test");
        },
        async validateSamlResponse(): Promise<AuthenticatedUser> {
            if (rejectionReason) {
                throw new Error(rejectionReason);
            }

            return AUTHENTICATED_USER;
        },
        describeMetadata(): string {
            throw new Error("not used in this test");
        },
    };
}

/*
 * A fake issuer: it records who it was asked to mint a token for and signs nothing, so
 * the use case can be tested without any key material.
 */
function createRecordingAccessTokenIssuer() {
    const issuedFor: AuthenticatedUser[] = [];

    const accessTokens: AccessTokenIssuer = {
        async issue(user) {
            issuedFor.push(user);
            return `token-${issuedFor.length}`;
        },
        verify(): Promise<AuthenticatedUser> {
            throw new Error("not used in this test");
        },
    };

    return {accessTokens, issuedFor};
}

function createUseCase(rejectionReason?: string) {
    const {accessTokens, issuedFor} = createRecordingAccessTokenIssuer();

    return {
        useCase: new CompleteSingleSignOnUseCase(createStubSamlGateway(rejectionReason), accessTokens),
        issuedFor,
    };
}

describe("CompleteSingleSignOnUseCase", () => {
    it("mints an access token for the asserted user once validation succeeds", async () => {
        const {useCase, issuedFor} = createUseCase();

        const result = await useCase.execute({samlResponse: "base64", relayState: "/profile"});

        expect(issuedFor).toEqual([AUTHENTICATED_USER]);
        expect(result.accessToken).toBe("token-1");
    });

    it("sends the browser back to RelayState when it is a local path", async () => {
        const {useCase} = createUseCase();

        const result = await useCase.execute({samlResponse: "base64", relayState: "/orders/42"});

        expect(result.returnTo).toBe("/orders/42");
    });

    it.each(["", "https://attacker.example.test", "//attacker.example.test"])(
        "falls back to the default landing page for RelayState %p",
        async (relayState) => {
            const {useCase} = createUseCase();

            const result = await useCase.execute({samlResponse: "base64", relayState});

            expect(result.returnTo).toBe("/profile");
        },
    );

    it("mints no token when validation fails", async () => {
        const {useCase, issuedFor} = createUseCase("Invalid signature");

        await expect(
            useCase.execute({samlResponse: "tampered", relayState: "/profile"}),
        ).rejects.toThrow(/Invalid signature/);
        expect(issuedFor).toHaveLength(0);
    });
});
