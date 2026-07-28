"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { DOMParser } = require("@xmldom/xmldom");
const xpath = require("xpath");

const {
    createUnsignedSamlResponse,
} = require("../../../src/features/identity-provider/saml-response.factory");

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

test("Audience 是目标 SP 的 Entity ID", () => {
    const samlResponse = buildSamlResponse();

    assert.equal(readText(samlResponse, "//*[local-name(.)='Audience']"), SERVICE_PROVIDER.entityId);
});

test("Destination 和 Recipient 都指向 SP 的 ACS 地址", () => {
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

test("有效期从 issuedAt 起算，NotBefore 按约定的时钟偏差提前", () => {
    const samlResponse = buildSamlResponse();
    const conditions = "//*[local-name(.)='Conditions']";

    assert.equal(readText(samlResponse, `${conditions}/@NotBefore`), "2026-07-28T08:59:55.000Z");
    assert.equal(readText(samlResponse, `${conditions}/@NotOnOrAfter`), "2026-07-28T09:05:00.000Z");
});

test("把 AuthnRequest 的 ID 回填到 Response 与 SubjectConfirmationData", () => {
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

test("NameID 与用户属性来自传入的用户", () => {
    const samlResponse = buildSamlResponse({
        user: { uid: "sakura", email: "sakura@example.test", role: "auditor" },
    });

    assert.equal(readText(samlResponse, "//*[local-name(.)='NameID']"), "sakura");
    assert.equal(readAttribute(samlResponse, "uid"), "sakura");
    assert.equal(readAttribute(samlResponse, "email"), "sakura@example.test");
    assert.equal(readAttribute(samlResponse, "role"), "auditor");
});

test("状态码是 Success", () => {
    const samlResponse = buildSamlResponse();

    assert.equal(
        readText(samlResponse, "//*[local-name(.)='StatusCode']/@Value"),
        "urn:oasis:names:tc:SAML:2.0:status:Success",
    );
});

test("每次签发都使用新的 Response ID 与 Assertion ID", () => {
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
