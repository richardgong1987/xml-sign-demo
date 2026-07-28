import {AuthenticatedUser} from "../domain/authenticated-user";
import {ServiceProviderConfig, readServiceProviderConfig} from "../config/service-provider.config";
import {createJoseAccessTokenIssuer} from "./jose-access-token.issuer";

const USER: AuthenticatedUser = {
    nameId: "xh-gong",
    uid: "xh-gong",
    email: "xh-demo@example.com.jp",
    role: "developer",
    sessionIndex: "_session-1",
};

function configWithSecret(secret: string): ServiceProviderConfig {
    return readServiceProviderConfig({SP_ACCESS_TOKEN_SECRET: secret});
}

describe("createJoseAccessTokenIssuer", () => {
    it("round-trips the asserted identity through a token", async () => {
        const issuer = createJoseAccessTokenIssuer(configWithSecret("demo-secret-demo-secret-demo!!"));

        expect(await issuer.verify(await issuer.issue(USER))).toEqual(USER);
    });

    it("issues a three-part JWT rather than an opaque session id", async () => {
        const issuer = createJoseAccessTokenIssuer(configWithSecret("demo-secret-demo-secret-demo!!"));

        expect((await issuer.issue(USER)).split(".")).toHaveLength(3);
    });

    it("refuses a token signed with a different secret", async () => {
        const token = await createJoseAccessTokenIssuer(
            configWithSecret("one-secret-one-secret-one-secr"),
        ).issue(USER);
        const otherIssuer = createJoseAccessTokenIssuer(
            configWithSecret("another-secret-another-secret!"),
        );

        await expect(otherIssuer.verify(token)).rejects.toThrow();
    });

    it("refuses a token whose payload was edited after signing", async () => {
        const issuer = createJoseAccessTokenIssuer(configWithSecret("demo-secret-demo-secret-demo!!"));
        const [header, payload, signature] = (await issuer.issue(USER)).split(".");

        const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
        const forged = Buffer.from(JSON.stringify({...claims, role: "administrator"}), "utf8").toString(
            "base64url",
        );

        await expect(issuer.verify([header, forged, signature].join("."))).rejects.toThrow();
    });

    it("refuses a token that has expired", async () => {
        const config = configWithSecret("demo-secret-demo-secret-demo!!");
        const issuer = createJoseAccessTokenIssuer(config);
        const token = await issuer.issue(USER);

        // Move past the token's lifetime rather than waiting for it.
        jest.useFakeTimers().setSystemTime(Date.now() + (config.accessTokenLifetimeSeconds + 60) * 1_000);

        try {
            await expect(issuer.verify(token)).rejects.toThrow();
        } finally {
            jest.useRealTimers();
        }
    });
});
