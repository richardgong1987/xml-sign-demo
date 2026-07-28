import test from "node:test";
import assert from "node:assert/strict";
import { DOMParser } from "@xmldom/xmldom";
import xpath from "xpath";

import {
    createUnsignedSamlResponse,
} from "../../../src/identity-provider/models/saml-response.factory.js";

const ISSUED_AT = new Date("2026-07-28T09:00:00.000Z");

const SERVICE_PROVIDER = Object.freeze({
    entityId: "https://jsl-online.example.test/metadata",
    assertionConsumerServiceUrl: "https://jsl-online.example.test/api/saml/acs",
});

function buildSamlResponse(overrides = {}) {
    return createUnsignedSamlResponse({
        identityProviderEntityId: "https://openam.example.test/idp",
        serviceProvider: SERVICE_PROVIDER,
        user: { uid: "hanjin", email: "hanjin@example.test", role: "trader" },
        authnRequestId: "_authn-request-1",
        issuedAt: ISSUED_AT,
        assertionLifetimeMs: 5 * 60_000,
        acceptedClockSkewMs: 5_000,
        ...overrides,
    });
}

function readText(samlResponseXml, expression) {
    const document = new DOMParser().parseFromString(samlResponseXml, "application/xml");

    return xpath.select(`string(${expression})`, document);
}

test("sets Audience to the target SP's entity ID", () => {
    const samlResponse = buildSamlResponse();

    assert.equal(readText(samlResponse, "//*[local-name(.)='Audience']"), SERVICE_PROVIDER.entityId);
});

test("points both Destination and Recipient at the SP's ACS URL", () => {
    const samlResponse = buildSamlResponse();

    assert.equal(
        readText(samlResponse, "/*[local-name(.)='Response']/@Destination"),
        SERVICE_PROVIDER.assertionConsumerServiceUrl,
    );
    assert.equal(
        readText(samlResponse, "//*[local-name(.)='SubjectConfirmationData']/@Recipient"),
        SERVICE_PROVIDER.assertionConsumerServiceUrl,
    );
});

test("derives the validity window from issuedAt, moving NotBefore back by the accepted clock skew", () => {
    const samlResponse = buildSamlResponse();
    const conditions = "//*[local-name(.)='Conditions']";

    assert.equal(readText(samlResponse, `${conditions}/@NotBefore`), "2026-07-28T08:59:55.000Z");
    assert.equal(readText(samlResponse, `${conditions}/@NotOnOrAfter`), "2026-07-28T09:05:00.000Z");
});

test("echoes the AuthnRequest ID into Response and SubjectConfirmationData", () => {
    const samlResponse = buildSamlResponse({ authnRequestId: "_authn-request-42" });

    assert.equal(
        readText(samlResponse, "/*[local-name(.)='Response']/@InResponseTo"),
        "_authn-request-42",
    );
    assert.equal(
        readText(samlResponse, "//*[local-name(.)='SubjectConfirmationData']/@InResponseTo"),
        "_authn-request-42",
    );
});

test("takes NameID and the attributes from the given user", () => {
    const samlResponse = buildSamlResponse({
        user: { uid: "sakura", email: "sakura@example.test", role: "auditor" },
    });

    assert.equal(readText(samlResponse, "//*[local-name(.)='NameID']"), "sakura");
    assert.equal(readAttribute(samlResponse, "uid"), "sakura");
    assert.equal(readAttribute(samlResponse, "email"), "sakura@example.test");
    assert.equal(readAttribute(samlResponse, "role"), "auditor");
});

test("reports a Success status code", () => {
    const samlResponse = buildSamlResponse();

    assert.equal(
        readText(samlResponse, "//*[local-name(.)='StatusCode']/@Value"),
        "urn:oasis:names:tc:SAML:2.0:status:Success",
    );
});

test("uses fresh Response and Assertion IDs on every issue", () => {
    const responseIdPath = "/*[local-name(.)='Response']/@ID";
    const assertionIdPath = "//*[local-name(.)='Assertion']/@ID";

    const first = buildSamlResponse();
    const second = buildSamlResponse();

    assert.notEqual(readText(first, responseIdPath), readText(second, responseIdPath));
    assert.notEqual(readText(first, responseIdPath), readText(first, assertionIdPath));
});

function readAttribute(samlResponseXml, name) {
    return readText(
        samlResponseXml,
        `//*[local-name(.)='Attribute'][@Name='${name}']/*[local-name(.)='AttributeValue']`,
    );
}
