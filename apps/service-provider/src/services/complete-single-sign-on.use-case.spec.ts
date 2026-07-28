import {ServiceProviderConfig, readServiceProviderConfig} from "../config/service-provider.config";
import {AuthenticatedUser} from "../domain/authenticated-user";
import {CompleteSingleSignOnUseCase} from "./complete-single-sign-on.use-case";
import {JwtUtil} from "./jwt-util";
import {SamlGateway} from "./saml-gateway";

const AUTHENTICATED_USER: AuthenticatedUser = {
    nameId: "xh-gong",
    uid: "xh-gong",
    email: "xh-demo@example.com.jp",
    role: "developer",
    sessionIndex: "_session-1",
};

const config: ServiceProviderConfig = readServiceProviderConfig({
    SP_ACCESS_TOKEN_SECRET: "use-case-secret-use-case-secret",
});

/*
 * A fake gateway that can be told to accept or reject, so "what happens on an invalid
 * signature" needs no forged XML signature. The JWT is left real — HMAC is cheap, and a
 * token the test can verify is a stronger assertion than a stub string.
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

function createUseCase(rejectionReason?: string): CompleteSingleSignOnUseCase {
    return new CompleteSingleSignOnUseCase(createStubSamlGateway(rejectionReason), config);
}

describe("CompleteSingleSignOnUseCase", () => {
    it("signs an access token the SP can verify back to the asserted user", async () => {
        const result = await createUseCase().execute({samlResponse: "base64", relayState: "/profile"});

        expect(await JwtUtil.verify(config, result.accessToken)).toEqual(AUTHENTICATED_USER);
    });

    it("sends the browser back to RelayState when it is a local path", async () => {
        const result = await createUseCase().execute({samlResponse: "base64", relayState: "/orders/42"});

        expect(result.returnTo).toBe("/orders/42");
    });

    it.each(["", "https://attacker.example.test", "//attacker.example.test"])(
        "falls back to the default landing page for RelayState %p",
        async (relayState) => {
            const result = await createUseCase().execute({samlResponse: "base64", relayState});

            expect(result.returnTo).toBe("/profile");
        },
    );

    it("signs no token when validation fails", async () => {
        await expect(
            createUseCase("Invalid signature").execute({samlResponse: "tampered", relayState: "/profile"}),
        ).rejects.toThrow(/Invalid signature/);
    });
});
