import {Test} from "@nestjs/testing";

import {AuthenticatedUser} from "../models/authenticated-user";
import {CompleteSingleSignOnUseCase} from "./complete-single-sign-on.use-case";
import {SamlGateway} from "./saml-gateway";
import {SessionStore} from "./session-store";

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

class RecordingSessionStore extends SessionStore {
    readonly createdUsers: AuthenticatedUser[] = [];

    create(user: AuthenticatedUser): string {
        this.createdUsers.push(user);
        return `session-${this.createdUsers.length}`;
    }

    find(): AuthenticatedUser | null {
        return null;
    }

    remove(): void {
        // not used in this test
    }
}

async function createUseCase(rejectionReason?: string) {
    const sessions = new RecordingSessionStore();
    const moduleRef = await Test.createTestingModule({
        providers: [
            CompleteSingleSignOnUseCase,
            {provide: SamlGateway, useValue: new StubSamlGateway(rejectionReason)},
            {provide: SessionStore, useValue: sessions},
        ],
    }).compile();

    return {useCase: moduleRef.get(CompleteSingleSignOnUseCase), sessions};
}

describe("CompleteSingleSignOnUseCase", () => {
    it("opens a session for the asserted user once validation succeeds", async () => {
        const {useCase, sessions} = await createUseCase();

        const result = await useCase.execute({samlResponse: "base64", relayState: "/profile"});

        expect(sessions.createdUsers).toEqual([AUTHENTICATED_USER]);
        expect(result.sessionId).toBe("session-1");
    });

    it("redirects to RelayState when it is a local path", async () => {
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

    it("opens no session when validation fails", async () => {
        const {useCase, sessions} = await createUseCase("Invalid signature");

        await expect(
            useCase.execute({samlResponse: "tampered", relayState: "/profile"}),
        ).rejects.toThrow(/Invalid signature/);
        expect(sessions.createdUsers).toHaveLength(0);
    });
});
