import { SignedXml } from "xml-crypto";

const ASSERTION_XPATH = "//*[local-name(.)='Assertion']";
const ASSERTION_ISSUER_XPATH = `${ASSERTION_XPATH}/*[local-name(.)='Issuer']`;

/**
 * AssertionSignerPort implementation: applies an XML digital signature to
 * <saml:Assertion> using the IdP private key.
 *
 * It signs the assertion rather than the whole response, which is the common choice
 * in SAML deployments: the response is only a delivery envelope, while the identity
 * assertion inside it is what must be tamper-proof.
 *
 * @param {string} privateKeyPem
 * @returns {{ signAssertion: (samlResponseXml: string) => string }}
 */
export function createXmlCryptoAssertionSigner(privateKeyPem) {
    return Object.freeze({
        signAssertion(samlResponseXml) {
            const signer = new SignedXml({
                privateKey: privateKeyPem,
                canonicalizationAlgorithm: "http://www.w3.org/2001/10/xml-exc-c14n#",
                signatureAlgorithm: "http://www.w3.org/2001/04/xmldsig-more#rsa-sha256",
            });

            signer.addReference({
                xpath: ASSERTION_XPATH,
                digestAlgorithm: "http://www.w3.org/2001/04/xmlenc#sha256",
                transforms: [
                    // Exclude <Signature> itself from the digest, or it could never be consistent.
                    "http://www.w3.org/2000/09/xmldsig#enveloped-signature",
                    "http://www.w3.org/2001/10/xml-exc-c14n#",
                ],
            });

            // SAML places <Signature> directly after the assertion's <Issuer>.
            signer.computeSignature(samlResponseXml, {
                location: { reference: ASSERTION_ISSUER_XPATH, action: "after" },
            });

            return signer.getSignedXml();
        },
    });
}

