import {ServiceProviderConfig, readServiceProviderConfig} from "../config/service-provider.config";
import {AuthenticatedUser} from "../domain/authenticated-user";
import {JwtUtil} from "./jwt-util";

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

describe("JwtUtil", () => {
    it("round-trips the asserted identity through a token", async () => {
        const config = configWithSecret("demo-secret-demo-secret-demo!!");

        expect(await JwtUtil.verify(config, await JwtUtil.sign(config, USER))).toEqual(USER);
    });

    it("signs a three-part JWT rather than an opaque session id", async () => {
        const config = configWithSecret("demo-secret-demo-secret-demo!!");

        expect((await JwtUtil.sign(config, USER)).split(".")).toHaveLength(3);
    });

    it("refuses a token signed with a different secret", async () => {
        const token = await JwtUtil.sign(configWithSecret("one-secret-one-secret-one-secr"), USER);

        await expect(
            JwtUtil.verify(configWithSecret("another-secret-another-secret!"), token),
        ).rejects.toThrow();
    });

    it("refuses a token whose payload was edited after signing", async () => {
        const config = configWithSecret("demo-secret-demo-secret-demo!!");
        const [header, payload, signature] = (await JwtUtil.sign(config, USER)).split(".");

        const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
        const forged = Buffer.from(JSON.stringify({...claims, role: "administrator"}), "utf8").toString(
            "base64url",
        );

        await expect(JwtUtil.verify(config, [header, forged, signature].join("."))).rejects.toThrow();
    });

    it("refuses a token that has expired", async () => {
        const config = configWithSecret("demo-secret-demo-secret-demo!!");
        const token = await JwtUtil.sign(config, USER);

        // Move past the token's lifetime rather than waiting for it.
        jest.useFakeTimers().setSystemTime(Date.now() + (config.accessTokenLifetimeSeconds + 60) * 1_000);

        try {
            await expect(JwtUtil.verify(config, token)).rejects.toThrow();
        } finally {
            jest.useRealTimers();
        }
    });
});
