/*
 * Demo only: simulates a browser or network man-in-the-middle editing the signed
 * XML after the IdP produced it and before the browser POSTs it to the SP.
 *
 * This is not IdP business logic and has no place in production code. It exists so
 * that /api/saml/acs can demonstrate the signature-rejection path.
 */
const ROLE_ATTRIBUTE_VALUE = /(<saml:Attribute Name="role">\s*<saml:AttributeValue>)[^<]*/;

export function tamperWithRole(signedSamlResponse) {
    return signedSamlResponse.replace(ROLE_ATTRIBUTE_VALUE, "$1administrator");
}
