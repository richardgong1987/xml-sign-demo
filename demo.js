const crypto = require("node:crypto");
const {DOMParser} = require("@xmldom/xmldom");
const {SignedXml} = require("xml-crypto");
const xpath = require("xpath");

/*
 * 1. 生成一对 RSA 密钥
 *
 * 实际 SAML 环境：
 * privateKey：保存在 Nomura OpenAM
 * publicKey：交给 JSL-online
 */
const {privateKey, publicKey} = crypto.generateKeyPairSync("rsa", {
    modulusLength: 2048,

    privateKeyEncoding: {
        type: "pkcs8", format: "pem",
    },

    publicKeyEncoding: {
        type: "spki", format: "pem",
    },
});

/*
 * 2. 使用私钥签名 XML
 */
function signXml(xml) {
    const signer = new SignedXml({
        privateKey,

        canonicalizationAlgorithm: "http://www.w3.org/2001/10/xml-exc-c14n#",

        signatureAlgorithm: "http://www.w3.org/2001/04/xmldsig-more#rsa-sha256",
    });

    /*
     * 指定要签名的部分。
     * 这里选择 <Assertion> 节点。
     */
    signer.addReference({
        xpath: "//*[local-name(.)='Assertion']",

        digestAlgorithm: "http://www.w3.org/2001/04/xmlenc#sha256",

        transforms: ["http://www.w3.org/2000/09/xmldsig#enveloped-signature", "http://www.w3.org/2001/10/xml-exc-c14n#",],
    });

    /*
     * 计算签名，并把 <Signature> 放在
     * <Assertion> 节点里面。
     */
    signer.computeSignature(xml, {
        location: {
            reference: "//*[local-name(.)='Assertion']", action: "append",
        },
    });

    return signer.getSignedXml();
}

/*
 * 3. 使用公钥验证 XML
 */
function verifyXml(signedXml) {
    const document = new DOMParser().parseFromString(signedXml);

    /*
     * 从 XML 中找到 <Signature> 节点。
     */
    const signatureNode = xpath.select(`//*[local-name(.)='Signature'
       and namespace-uri(.)='http://www.w3.org/2000/09/xmldsig#']`, document,)[0];

    if (!signatureNode) {
        throw new Error("没有找到 Signature");
    }

    /*
     * 验证者只有公钥，没有私钥。
     */
    const verifier = new SignedXml({
        publicCert: publicKey,
    });

    verifier.loadSignature(signatureNode);

    /*
     * 内部会：
     * 1. 找到签名引用的 Assertion
     * 2. 规范化 XML
     * 3. 重新计算 SHA-256
     * 4. 比较 DigestValue
     * 5. 用公钥验证 SignatureValue
     */
    const valid = verifier.checkSignature(signedXml);

    return {
        valid,

        /*
         * 验证成功后，取得真正被签名保护的内容。
         */
        signedReferences: valid ? verifier.getSignedReferences() : [],
    };
}

/*
 * 4. 原始 XML
 */
const originalXml = `
<Response>
  <Assertion ID="_demo-123">
    <UserId>hanjin</UserId>
    <Role>user</Role>
  </Assertion>
</Response>
`;

/*
 * 5. 使用私钥签名
 */
const signedXml = signXml(originalXml);

console.log("签名后的 XML：");
console.log(signedXml);

/*
 * 6. 使用公钥验证原始 XML
 */
const originalResult = verifyXml(signedXml);

console.log("\n原始 XML 验证结果：", originalResult.valid);

/*
 * 7. 模拟攻击者篡改用户权限
 */
const tamperedXml = signedXml.replace("<Role>user</Role>", "<Role>admin</Role>",);

const tamperedResult = verifyXml(tamperedXml);

console.log("篡改 XML 验证结果：", tamperedResult.valid);

/*
 * 8. 读取真正被签名保护的内容
 */
console.log("\n真正被签名的 XML：");
console.log(originalResult.signedReferences[0]);