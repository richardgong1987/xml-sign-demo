import { toCertificateBody } from "../../shared/utils/x509-certificate.js";

/**
 * The metadata document the IdP publishes.
 *
 * This is the single channel through which trust is established between IdP and SP:
 * the SP learns the SSO endpoint and the signing certificate here, while the private
 * key never leaves the IdP.
 *
 * @param {{ entityId: string, singleSignOnUrl: string, certificatePem: string }} params
 * @returns {string}
 */
export function createIdentityProviderMetadata({ entityId, singleSignOnUrl, certificatePem }) {
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

