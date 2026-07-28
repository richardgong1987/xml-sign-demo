import test from "node:test";
import assert from "node:assert/strict";

import {
    IssueSamlResponseUseCase,
} from "../../../src/identity-provider/services/issue-saml-response.js";
import {
    createServiceProviderRegistry,
    UnregisteredServiceProviderError,
} from "../../../src/identity-provider/models/service-provider-registry.js";
import { UnknownUserError } from "../../../src/identity-provider/models/user-directory.js";

const IDENTITY_PROVIDER = Object.freeze({
    entityId: "https://openam.example.test/idp",
    assertionLifetimeMs: 5 * 60_000,
    acceptedClockSkewMs: 5_000,
});

const JSL_ONLINE = Object.freeze({
    entityId: "https://jsl-online.example.test/metadata",
    assertionConsumerServiceUrl: "https://jsl-online.example.test/api/saml/acs",
});

/*
 * Fake AssertionSignerPort: records the XML it is handed and performs no cryptography,
 * so the use-case layer can be tested without any key material.
 */
function createRecordingAssertionSigner() {
    const signedDocuments = [];

    return {
        signedDocuments,
        signAssertion(samlResponseXml) {
            signedDocuments.push(samlResponseXml);
            return `<signed>${samlResponseXml}</signed>`;
        },
    };
}

function createUseCase(assertionSigner) {
    return new IssueSamlResponseUseCase({
        identityProvider: IDENTITY_PROVIDER,
        serviceProviderRegistry: createServiceProviderRegistry([JSL_ONLINE]),
        assertionSigner,
        clock: { now: () => new Date("2026-07-28T09:00:00.000Z") },
    });
}

function validCommand(overrides = {}) {
    return {
        uid: "hanjin",
        serviceProviderEntityId: JSL_ONLINE.entityId,
        authnRequestId: "_authn-request-1",
        ...overrides,
    };
}

test("takes the delivery address from the IdP registry rather than the request", () => {
    const result = createUseCase(createRecordingAssertionSigner()).execute(validCommand());

    assert.equal(result.assertionConsumerServiceUrl, JSL_ONLINE.assertionConsumerServiceUrl);
});

test("returns the signed SAMLResponse", () => {
    const assertionSigner = createRecordingAssertionSigner();

    const result = createUseCase(assertionSigner).execute(validCommand());

    assert.equal(assertionSigner.signedDocuments.length, 1);
    assert.equal(result.samlResponse, `<signed>${assertionSigner.signedDocuments[0]}</signed>`);
});

test("stamps the assertion with the time from the injected clock", () => {
    const assertionSigner = createRecordingAssertionSigner();

    createUseCase(assertionSigner).execute(validCommand());

    assert.match(assertionSigner.signedDocuments[0], /IssueInstant="2026-07-28T09:00:00\.000Z"/);
});

test("never reaches the signing step for an unknown user", () => {
    const assertionSigner = createRecordingAssertionSigner();
    const useCase = createUseCase(assertionSigner);

    assert.throws(() => useCase.execute(validCommand({ uid: "nobody" })), UnknownUserError);
    assert.equal(assertionSigner.signedDocuments.length, 0);
});

test("never reaches the signing step for an unregistered SP", () => {
    const assertionSigner = createRecordingAssertionSigner();
    const useCase = createUseCase(assertionSigner);

    assert.throws(
        () =>
            useCase.execute(
                validCommand({ serviceProviderEntityId: "https://attacker.example.test/metadata" }),
            ),
        UnregisteredServiceProviderError,
    );
    assert.equal(assertionSigner.signedDocuments.length, 0);
});
