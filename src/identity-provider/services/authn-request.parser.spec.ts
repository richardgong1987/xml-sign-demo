import zlib from "node:zlib";

import {AuthnRequestParser, InvalidAuthnRequestError} from "./authn-request.parser";

const SP_ENTITY_ID = "https://jsl-online.example.test/api/saml/metadata";

/*
 * The HTTP-Redirect binding carries the request as base64(raw deflate(XML)), so every
 * case has to be encoded the same way a service provider would encode it.
 */
function encodeRedirectBinding(authnRequestXml: string): string {
    return zlib.deflateRawSync(Buffer.from(authnRequestXml, "utf8")).toString("base64");
}

function authnRequestXml({id = "_request-1", issuer = SP_ENTITY_ID} = {}): string {
    return `<samlp:AuthnRequest
    xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol"
    xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion"
    ID="${id}"
    Version="2.0"
    AssertionConsumerServiceURL="https://jsl-online.example.test/api/saml/acs">
  <saml:Issuer>${issuer}</saml:Issuer>
</samlp:AuthnRequest>`;
}

describe("AuthnRequestParser", () => {
    const parser = new AuthnRequestParser();

    it("reads the request ID and the issuing SP from a redirect-binding request", () => {
        const authnRequest = parser.parseRedirectBinding(encodeRedirectBinding(authnRequestXml()));

        expect(authnRequest).toEqual({
            requestId: "_request-1",
            serviceProviderEntityId: SP_ENTITY_ID,
        });
    });

    it.each([
        [
            "no prefix",
            `<AuthnRequest xmlns="urn:oasis:names:tc:SAML:2.0:protocol" ID="_request-2">
  <Issuer xmlns="urn:oasis:names:tc:SAML:2.0:assertion">${SP_ENTITY_ID}</Issuer>
</AuthnRequest>`,
            "_request-2",
        ],
        [
            "an unusual prefix",
            `<x:AuthnRequest xmlns:x="urn:oasis:names:tc:SAML:2.0:protocol"
    xmlns:y="urn:oasis:names:tc:SAML:2.0:assertion" ID="_request-3">
  <y:Issuer>${SP_ENTITY_ID}</y:Issuer>
</x:AuthnRequest>`,
            "_request-3",
        ],
    ])("ignores the namespace choice: %s", (_name, xml, expectedId) => {
        const authnRequest = parser.parseRedirectBinding(encodeRedirectBinding(xml));

        expect(authnRequest.requestId).toBe(expectedId);
        expect(authnRequest.serviceProviderEntityId).toBe(SP_ENTITY_ID);
    });

    it("strips the indentation a pretty-printed Issuer leaves around the entity ID", () => {
        const pretty = `<samlp:AuthnRequest
    xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol"
    xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion"
    ID="_request-4">
  <saml:Issuer>
    ${SP_ENTITY_ID}
  </saml:Issuer>
</samlp:AuthnRequest>`;

        expect(parser.parseRedirectBinding(encodeRedirectBinding(pretty)).serviceProviderEntityId).toBe(
            SP_ENTITY_ID,
        );
    });

    it("returns a frozen model so no later stage can rewrite the issuer", () => {
        const authnRequest = parser.parseRedirectBinding(
            encodeRedirectBinding(authnRequestXml()),
        ) as { serviceProviderEntityId: string };

        expect(() => {
            authnRequest.serviceProviderEntityId = "https://attacker.example.test/metadata";
        }).toThrow(TypeError);
    });

    it.each([undefined, ""])("rejects a missing SAMLRequest parameter (%p)", (missing) => {
        expect(() => parser.parseRedirectBinding(missing)).toThrow(InvalidAuthnRequestError);
    });

    it("rejects a payload that is not deflate-compressed, keeping the underlying error as cause", () => {
        let thrown: unknown;

        try {
            parser.parseRedirectBinding("!!!not-base64-or-deflate!!!");
        } catch (error) {
            thrown = error;
        }

        expect(thrown).toBeInstanceOf(InvalidAuthnRequestError);
        expect((thrown as Error).message).toMatch(/base64 or deflate decoding failed/);

        // The zlib failure is kept as the cause. Its constructor comes from Node's own
        // realm, which Jest isolates, so assert on the shape rather than instanceof.
        expect(typeof ((thrown as Error).cause as Error | undefined)?.message).toBe("string");
    });

    it("rejects a payload that decompresses to something other than XML", () => {
        expect(() =>
            parser.parseRedirectBinding(encodeRedirectBinding("this is not xml at all")),
        ).toThrow(/not valid XML/);
    });

    it("rejects an AuthnRequest without an ID", () => {
        const withoutId = `<samlp:AuthnRequest
    xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol"
    xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion">
  <saml:Issuer>${SP_ENTITY_ID}</saml:Issuer>
</samlp:AuthnRequest>`;

        expect(() => parser.parseRedirectBinding(encodeRedirectBinding(withoutId))).toThrow(
            InvalidAuthnRequestError,
        );
    });

    it("rejects an AuthnRequest without an Issuer", () => {
        expect(() =>
            parser.parseRedirectBinding(encodeRedirectBinding(authnRequestXml({issuer: ""}))),
        ).toThrow(InvalidAuthnRequestError);
    });

    it("rejects a well-formed SAML message that is not an AuthnRequest", () => {
        const logoutRequest = `<samlp:LogoutRequest
    xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol"
    xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion"
    ID="_logout-1">
  <saml:Issuer>${SP_ENTITY_ID}</saml:Issuer>
</samlp:LogoutRequest>`;

        expect(() => parser.parseRedirectBinding(encodeRedirectBinding(logoutRequest))).toThrow(
            InvalidAuthnRequestError,
        );
    });
});
