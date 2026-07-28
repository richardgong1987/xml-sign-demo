import {Test} from "@nestjs/testing";

import {IDENTITY_PROVIDER_CONFIG, IdentityProviderConfig} from "../identity-provider.config";
import {Clock} from "../shared/clock";
import {ServiceProviderRegistry, UnregisteredServiceProviderError,} from "../models/service-provider-registry";
import {UnknownUserError, UserDirectory} from "../models/user-directory";
import {AssertionSigner} from "./assertion-signer";
import {IssueSamlResponseCommand, IssueSamlResponseUseCase} from "./issue-saml-response.use-case";

const JSL_ONLINE = {
    entityId: "https://jsl-online.example.test/metadata",
    assertionConsumerServiceUrl: "https://jsl-online.example.test/api/saml/acs",
};

const IDENTITY_PROVIDER: IdentityProviderConfig = {
    port: 4000,
    entityId: "https://openam.example.test/idp",
    singleSignOnUrl: "https://openam.example.test/sso",
    assertionLifetimeMs: 5 * 60_000,
    acceptedClockSkewMs: 5_000,
    registeredServiceProviders: [JSL_ONLINE],
};

/*
 * A fake AssertionSigner: it records the XML it is handed and performs no cryptography,
 * so the use case can be tested without any key material.
 */
class RecordingAssertionSigner extends AssertionSigner {
    readonly signedDocuments: string[] = [];

    signAssertion(samlResponseXml: string): string {
        this.signedDocuments.push(samlResponseXml);
        return `<signed>${samlResponseXml}</signed>`;
    }
}

class FixedClock extends Clock {
    now(): Date {
        return new Date("2026-07-28T09:00:00.000Z");
    }
}

const [DEMO_USER] = new UserDirectory().list();

function validCommand(overrides: Partial<IssueSamlResponseCommand> = {}): IssueSamlResponseCommand {
    return {
        uid: DEMO_USER.uid,
        serviceProviderEntityId: JSL_ONLINE.entityId,
        authnRequestId: "_authn-request-1",
        ...overrides,
    };
}

describe("IssueSamlResponseUseCase", () => {
    let useCase: IssueSamlResponseUseCase;
    let assertionSigner: RecordingAssertionSigner;

    beforeEach(async () => {
        assertionSigner = new RecordingAssertionSigner();

        const moduleRef = await Test.createTestingModule({
            providers: [
                IssueSamlResponseUseCase,
                UserDirectory,
                ServiceProviderRegistry,
                {provide: IDENTITY_PROVIDER_CONFIG, useValue: IDENTITY_PROVIDER},
                {provide: AssertionSigner, useValue: assertionSigner},
                {provide: Clock, useClass: FixedClock},
            ],
        }).compile();

        useCase = moduleRef.get(IssueSamlResponseUseCase);
    });

    it("takes the delivery address from the IdP registry rather than the request", () => {
        expect(useCase.execute(validCommand()).assertionConsumerServiceUrl).toBe(
            JSL_ONLINE.assertionConsumerServiceUrl,
        );
    });

    it("returns the signed SAMLResponse", () => {
        const issued = useCase.execute(validCommand());

        expect(assertionSigner.signedDocuments).toHaveLength(1);
        expect(issued.samlResponse).toBe(`<signed>${assertionSigner.signedDocuments[0]}</signed>`);
    });

    it("stamps the assertion with the time from the injected clock", () => {
        useCase.execute(validCommand());

        expect(assertionSigner.signedDocuments[0]).toMatch(/IssueInstant="2026-07-28T09:00:00\.000Z"/);
    });

    it("never reaches the signing step for an unknown user", () => {
        expect(() => useCase.execute(validCommand({uid: "nobody"}))).toThrow(UnknownUserError);
        expect(assertionSigner.signedDocuments).toHaveLength(0);
    });

    it("never reaches the signing step for an unregistered SP", () => {
        expect(() =>
            useCase.execute(
                validCommand({serviceProviderEntityId: "https://attacker.example.test/metadata"}),
            ),
        ).toThrow(UnregisteredServiceProviderError);
        expect(assertionSigner.signedDocuments).toHaveLength(0);
    });
});
