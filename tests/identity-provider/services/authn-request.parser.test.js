import test from "node:test";
import assert from "node:assert/strict";
import zlib from "node:zlib";

import {
    parseRedirectBindingAuthnRequest,
    InvalidAuthnRequestError,
} from "../../../src/identity-provider/services/authn-request.parser.js";

const SP_ENTITY_ID = "https://jsl-online.example.test/api/saml/metadata";

/*
 * The HTTP-Redirect binding carries the request as base64(raw deflate(XML)),
 * so every case has to be encoded the same way the SP would encode it.
 */
function encodeRedirectBinding(authnRequestXml) {
    return zlib.deflateRawSync(Buffer.from(authnRequestXml, "utf8")).toString("base64");
}

function authnRequestXml({ id = "_request-1", issuer = SP_ENTITY_ID } = {}) {
    return `<samlp:AuthnRequest
    xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol"
    xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion"
    ID="${id}"
    Version="2.0"
    AssertionConsumerServiceURL="https://jsl-online.example.test/api/saml/acs">
  <saml:Issuer>${issuer}</saml:Issuer>
</samlp:AuthnRequest>`;
}

test("reads the request ID and the issuing SP from a redirect-binding request", () => {
    const authnRequest = parseRedirectBindingAuthnRequest(encodeRedirectBinding(authnRequestXml()));

    assert.equal(authnRequest.requestId, "_request-1");
    assert.equal(authnRequest.serviceProviderEntityId, SP_ENTITY_ID);
});

test("ignores the namespace prefix a service provider happens to choose", () => {
    const noPrefix = `<AuthnRequest xmlns="urn:oasis:names:tc:SAML:2.0:protocol" ID="_request-2">
  <Issuer xmlns="urn:oasis:names:tc:SAML:2.0:assertion">${SP_ENTITY_ID}</Issuer>
</AuthnRequest>`;
    const oddPrefix = `<x:AuthnRequest xmlns:x="urn:oasis:names:tc:SAML:2.0:protocol"
    xmlns:y="urn:oasis:names:tc:SAML:2.0:assertion" ID="_request-3">
  <y:Issuer>${SP_ENTITY_ID}</y:Issuer>
</x:AuthnRequest>`;

    for (const [xml, expectedId] of [[noPrefix, "_request-2"], [oddPrefix, "_request-3"]]) {
        const authnRequest = parseRedirectBindingAuthnRequest(encodeRedirectBinding(xml));

        assert.equal(authnRequest.requestId, expectedId);
        assert.equal(authnRequest.serviceProviderEntityId, SP_ENTITY_ID);
    }
});

test("strips the indentation a pretty-printed Issuer leaves around the entity ID", () => {
    const pretty = `<samlp:AuthnRequest
    xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol"
    xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion"
    ID="_request-4">
  <saml:Issuer>
    ${SP_ENTITY_ID}
  </saml:Issuer>
</samlp:AuthnRequest>`;

    const authnRequest = parseRedirectBindingAuthnRequest(encodeRedirectBinding(pretty));

    assert.equal(authnRequest.serviceProviderEntityId, SP_ENTITY_ID);
});

test("returns a frozen model so no later stage can rewrite the issuer", () => {
    const authnRequest = parseRedirectBindingAuthnRequest(encodeRedirectBinding(authnRequestXml()));

    assert.throws(() => {
        authnRequest.serviceProviderEntityId = "https://attacker.example.test/metadata";
    }, TypeError);
});

test("rejects a missing SAMLRequest parameter", () => {
    for (const missing of [undefined, "", null]) {
        assert.throws(
            () => parseRedirectBindingAuthnRequest(missing),
            InvalidAuthnRequestError,
            `SAMLRequest=${missing} should be rejected`,
        );
    }
});

test("rejects a payload that is not deflate-compressed, keeping the underlying error as cause", () => {
    assert.throws(
        () => parseRedirectBindingAuthnRequest("!!!not-base64-or-deflate!!!"),
        (error) => {
            assert.ok(error instanceof InvalidAuthnRequestError);
            assert.match(error.message, /base64 or deflate decoding failed/);
            assert.ok(error.cause instanceof Error, "the zlib failure should be kept as cause");
            return true;
        },
    );
});

test("rejects a payload that decompresses to something other than XML", () => {
    assert.throws(
        () => parseRedirectBindingAuthnRequest(encodeRedirectBinding("this is not xml at all")),
        (error) => {
            assert.ok(error instanceof InvalidAuthnRequestError);
            assert.match(error.message, /not valid XML/);
            return true;
        },
    );
});

test("rejects an AuthnRequest without an ID", () => {
    const withoutId = `<samlp:AuthnRequest
    xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol"
    xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion">
  <saml:Issuer>${SP_ENTITY_ID}</saml:Issuer>
</samlp:AuthnRequest>`;

    assert.throws(
        () => parseRedirectBindingAuthnRequest(encodeRedirectBinding(withoutId)),
        InvalidAuthnRequestError,
    );
});

test("rejects an AuthnRequest without an Issuer", () => {
    assert.throws(
        () => parseRedirectBindingAuthnRequest(encodeRedirectBinding(authnRequestXml({ issuer: "" }))),
        InvalidAuthnRequestError,
    );
});

test("rejects a well-formed SAML message that is not an AuthnRequest", () => {
    const logoutRequest = `<samlp:LogoutRequest
    xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol"
    xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion"
    ID="_logout-1">
  <saml:Issuer>${SP_ENTITY_ID}</saml:Issuer>
</samlp:LogoutRequest>`;

    assert.throws(
        () => parseRedirectBindingAuthnRequest(encodeRedirectBinding(logoutRequest)),
        InvalidAuthnRequestError,
    );
});
