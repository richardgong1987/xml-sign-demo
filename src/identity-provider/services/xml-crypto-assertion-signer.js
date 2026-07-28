import { SignedXml } from "xml-crypto";

const ASSERTION_XPATH = "//*[local-name(.)='Assertion']";
const ASSERTION_ISSUER_XPATH = `${ASSERTION_XPATH}/*[local-name(.)='Issuer']`;

/**
 * AssertionSignerPort 的实现：用 IdP 私钥对 <saml:Assertion> 做 XML 数字签名。
 *
 * 签名对象是 Assertion 而不是整个 Response，这是 SAML 部署里最常见的做法：
 * Response 只是投递信封，真正需要防篡改的是里面的身份断言。
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
                    // 计算摘要时排除 <Signature> 自己，否则无法自洽。
                    "http://www.w3.org/2000/09/xmldsig#enveloped-signature",
                    "http://www.w3.org/2001/10/xml-exc-c14n#",
                ],
            });

            // SAML 约定 <Signature> 紧跟在 Assertion 的 <Issuer> 之后。
            signer.computeSignature(samlResponseXml, {
                location: { reference: ASSERTION_ISSUER_XPATH, action: "after" },
            });

            return signer.getSignedXml();
        },
    });
}

