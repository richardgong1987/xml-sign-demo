import {JwtModule} from "@nestjs/jwt";
import {Test} from "@nestjs/testing";

import {createServiceProviderConfig, SERVICE_PROVIDER_CONFIG} from "../service-provider.config";
import {AuthenticatedUser} from "../models/authenticated-user";
import {AccessTokenIssuer} from "./access-token";
import {JwtAccessTokenIssuer} from "./jwt-access-token.issuer";

const USER: AuthenticatedUser = {
    nameId: "hanjin",
    uid: "hanjin",
    email: "hanjin@example.test",
    role: "trader",
    sessionIndex: "_session-1",
};

const config = createServiceProviderConfig({
    port: 3000,
    identityProviderBaseUrl: "http://localhost:4000",
});

async function createIssuer(secret: string): Promise<AccessTokenIssuer> {
    const moduleRef = await Test.createTestingModule({
        imports: [
            JwtModule.register({
                secret,
                signOptions: {algorithm: "HS256"},
                verifyOptions: {algorithms: ["HS256"]},
            }),
        ],
        providers: [
            {provide: AccessTokenIssuer, useClass: JwtAccessTokenIssuer},
            {provide: SERVICE_PROVIDER_CONFIG, useValue: config},
        ],
    }).compile();

    return moduleRef.get(AccessTokenIssuer);
}

describe("JwtAccessTokenIssuer", () => {
    it("round-trips the asserted identity through a token", async () => {
        const issuer = await createIssuer("demo-secret");

        expect(issuer.verify(issuer.issue(USER))).toEqual(USER);
    });

    it("issues a three-part JWT rather than an opaque session id", async () => {
        const issuer = await createIssuer("demo-secret");

        expect(issuer.issue(USER).split(".")).toHaveLength(3);
    });

    it("refuses a token signed with a different secret", async () => {
        const token = (await createIssuer("one-secret")).issue(USER);
        const otherIssuer = await createIssuer("another-secret");

        expect(() => otherIssuer.verify(token)).toThrow();
    });

    it("refuses a token whose payload was edited after signing", async () => {
        const issuer = await createIssuer("demo-secret");
        const [header, payload, signature] = issuer.issue(USER).split(".");

        const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
        const forged = Buffer.from(
            JSON.stringify({...claims, role: "administrator"}),
            "utf8",
        ).toString("base64url");

        expect(() => issuer.verify([header, forged, signature].join("."))).toThrow();
    });

    it("refuses a token that has expired", async () => {
        const issuer = await createIssuer("demo-secret");
        const token = issuer.issue(USER);

        // Move past the token's lifetime rather than waiting for it.
        jest.useFakeTimers().setSystemTime(Date.now() + (config.accessTokenLifetimeSeconds + 60) * 1_000);

        try {
            expect(() => issuer.verify(token)).toThrow();
        } finally {
            jest.useRealTimers();
        }
    });
});
