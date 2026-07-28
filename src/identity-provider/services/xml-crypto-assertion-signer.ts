import { Inject, Injectable } from "@nestjs/common";
import { SignedXml } from "xml-crypto";

import { SIGNING_CREDENTIAL, SigningCredential } from "../../shared/signing-credential";
import { AssertionSigner } from "./assertion-signer";

const ASSERTION_XPATH = "//*[local-name(.)='Assertion']";
const ASSERTION_ISSUER_XPATH = `${ASSERTION_XPATH}/*[local-name(.)='Issuer']`;

/**
 * Signs <saml:Assertion> with the IdP private key using xml-crypto.
 *
 * It signs the assertion rather than the whole response, which is the common choice in
 * SAML deployments: the response is only a delivery envelope, while the identity
 * assertion inside it is what must be tamper-proof.
 */
@Injectable()
export class XmlCryptoAssertionSigner extends AssertionSigner {
    constructor(@Inject(SIGNING_CREDENTIAL) private readonly credential: SigningCredential) {
        super();
    }

    signAssertion(samlResponseXml: string): string {
        const signer = new SignedXml({
            privateKey: this.credential.privateKeyPem,
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
    }
}
