import {DOMParser} from "@xmldom/xmldom";
import xpath from "xpath";

import {createUnsignedSamlResponse, UnsignedSamlResponseSpec} from "./saml-response.factory";

const ISSUED_AT = new Date("2026-07-28T09:00:00.000Z");

const SERVICE_PROVIDER = {
    entityId: "https://jsl-online.example.test/metadata",
    assertionConsumerServiceUrl: "https://jsl-online.example.test/api/saml/acs",
};

function buildSamlResponse(overrides: Partial<UnsignedSamlResponseSpec> = {}): string {
    return createUnsignedSamlResponse({
        identityProviderEntityId: "https://openam.example.test/idp",
        serviceProvider: SERVICE_PROVIDER,
        user: {uid: "hanjin", email: "hanjin@example.test", role: "trader"},
        authnRequestId: "_authn-request-1",
        issuedAt: ISSUED_AT,
        assertionLifetimeMs: 5 * 60_000,
        acceptedClockSkewMs: 5_000,
        ...overrides,
    });
}

function read(samlResponseXml: string, expression: string): string {
    const document = new DOMParser().parseFromString(
        samlResponseXml,
        "application/xml",
    ) as unknown as Node;

    return String(xpath.select1(`string(${expression})`, document) ?? "");
}

function readAttribute(samlResponseXml: string, name: string): string {
    return read(
        samlResponseXml,
        `//*[local-name(.)='Attribute'][@Name='${name}']/*[local-name(.)='AttributeValue']`,
    );
}

describe("createUnsignedSamlResponse", () => {
    it("sets Audience to the target SP's entity ID", () => {
        expect(read(buildSamlResponse(), "//*[local-name(.)='Audience']")).toBe(
            SERVICE_PROVIDER.entityId,
        );
    });

    it("points both Destination and Recipient at the SP's ACS URL", () => {
        const samlResponse = buildSamlResponse();

        expect(read(samlResponse, "/*[local-name(.)='Response']/@Destination")).toBe(
            SERVICE_PROVIDER.assertionConsumerServiceUrl,
        );
        expect(read(samlResponse, "//*[local-name(.)='SubjectConfirmationData']/@Recipient")).toBe(
            SERVICE_PROVIDER.assertionConsumerServiceUrl,
        );
    });

    it("derives the validity window from issuedAt, moving NotBefore back by the accepted clock skew", () => {
        const samlResponse = buildSamlResponse();
        const conditions = "//*[local-name(.)='Conditions']";

        expect(read(samlResponse, `${conditions}/@NotBefore`)).toBe("2026-07-28T08:59:55.000Z");
        expect(read(samlResponse, `${conditions}/@NotOnOrAfter`)).toBe("2026-07-28T09:05:00.000Z");
    });

    it("echoes the AuthnRequest ID into Response and SubjectConfirmationData", () => {
        const samlResponse = buildSamlResponse({authnRequestId: "_authn-request-42"});

        expect(read(samlResponse, "/*[local-name(.)='Response']/@InResponseTo")).toBe(
            "_authn-request-42",
        );
        expect(read(samlResponse, "//*[local-name(.)='SubjectConfirmationData']/@InResponseTo")).toBe(
            "_authn-request-42",
        );
    });

    it("takes NameID and the attributes from the given user", () => {
        const samlResponse = buildSamlResponse({
            user: {uid: "sakura", email: "sakura@example.test", role: "auditor"},
        });

        expect(read(samlResponse, "//*[local-name(.)='NameID']")).toBe("sakura");
        expect(readAttribute(samlResponse, "uid")).toBe("sakura");
        expect(readAttribute(samlResponse, "email")).toBe("sakura@example.test");
        expect(readAttribute(samlResponse, "role")).toBe("auditor");
    });

    it("reports a Success status code", () => {
        expect(read(buildSamlResponse(), "//*[local-name(.)='StatusCode']/@Value")).toBe(
            "urn:oasis:names:tc:SAML:2.0:status:Success",
        );
    });

    it("uses fresh Response and Assertion IDs on every issue", () => {
        const responseId = "/*[local-name(.)='Response']/@ID";
        const assertionId = "//*[local-name(.)='Assertion']/@ID";

        const first = buildSamlResponse();
        const second = buildSamlResponse();

        expect(read(first, responseId)).not.toBe(read(second, responseId));
        expect(read(first, responseId)).not.toBe(read(first, assertionId));
    });
});
