"use strict";

const { toCertificateBody } = require("../../shared/x509-certificate");

/**
 * IdP 对外公布的 metadata。
 *
 * 这是 IdP 与 SP 之间建立信任的唯一入口：SP 从这里拿到 SSO 地址和签名证书，
 * 而私钥永远留在 IdP 一侧。
 *
 * @param {{ entityId: string, singleSignOnUrl: string, certificatePem: string }} params
 * @returns {string}
 */
function createIdentityProviderMetadata({ entityId, singleSignOnUrl, certificatePem }) {
    return `<?xml version="1.0" encoding="UTF-8"?>
<md:EntityDescriptor
    xmlns:md="urn:oasis:names:tc:SAML:2.0:metadata"
    xmlns:ds="http://www.w3.org/2000/09/xmldsig#"
    entityID="${entityId}">

  <md:IDPSSODescriptor
      WantAuthnRequestsSigned="false"
      protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol">

    <md:KeyDescriptor use="signing">
      <ds:KeyInfo>
        <ds:X509Data>
          <ds:X509Certificate>${toCertificateBody(certificatePem)}</ds:X509Certificate>
        </ds:X509Data>
      </ds:KeyInfo>
    </md:KeyDescriptor>

    <md:NameIDFormat>urn:oasis:names:tc:SAML:1.1:nameid-format:unspecified</md:NameIDFormat>

    <md:SingleSignOnService
        Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect"
        Location="${singleSignOnUrl}"/>

  </md:IDPSSODescriptor>
</md:EntityDescriptor>`;
}

module.exports = { createIdentityProviderMetadata };
