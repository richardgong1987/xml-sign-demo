const crypto = require("node:crypto");
const {DOMParser} = require("@xmldom/xmldom");
const {SignedXml} = require("xml-crypto");
const xpath = require("xpath");

/*
 * 1. 生成 RSA 私钥和公钥
 *
 * 实际 SAML 环境：
 * privateKey：保存在 Nomura OpenAM
 * publicKey/Certificate：提供给 JSL-online
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

        // 对 XML 进行标准化，避免格式差异影响哈希结果
        canonicalizationAlgorithm: "http://www.w3.org/2001/10/xml-exc-c14n#",

        // 使用 RSA + SHA-256 生成数字签名
        signatureAlgorithm: "http://www.w3.org/2001/04/xmldsig-more#rsa-sha256",
    });

    /*
     * 指定需要签名的 XML 节点。
     * 这里签名 <Assertion>。
     */
    signer.addReference({
        xpath: "//*[local-name(.)='Assertion']",

        // 使用 SHA-256 计算 Assertion 的内容指纹
        digestAlgorithm: "http://www.w3.org/2001/04/xmlenc#sha256",

        transforms: [// 计算哈希时排除 Signature 本身
            "http://www.w3.org/2000/09/xmldsig#enveloped-signature",

            // 对 Assertion 进行标准化
            "http://www.w3.org/2001/10/xml-exc-c14n#",],
    });

    /*
     * 计算签名。
     *
     * location 表示把生成的 <Signature>
     * 追加到 <Assertion> 里面。
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
    /*
     * 第二个参数必须指定 XML MIME 类型。
     */
    const document = new DOMParser().parseFromString(signedXml, "application/xml",);

    /*
     * 从 XML 中找到 XML Digital Signature 的
     * <Signature> 节点。
     */
    const signatureNodes = xpath.select(`//*[local-name(.)='Signature'
           and namespace-uri(.)='http://www.w3.org/2000/09/xmldsig#']`, document,);

    const signatureNode = signatureNodes[0];

    if (!signatureNode) {
        throw new Error("没有找到 Signature 节点");
    }

    /*
     * 验证方只有公钥，没有私钥。
     */
    const verifier = new SignedXml({
        publicCert: publicKey,
    });

    /*
     * 加载 XML 中携带的 Signature。
     */
    verifier.loadSignature(signatureNode);

    /*
     * 验证过程：
     *
     * 1. 根据 Reference URI 找到 Assertion
     * 2. 标准化 Assertion
     * 3. 重新计算 SHA-256
     * 4. 比较 DigestValue
     * 5. 使用公钥验证 SignatureValue
     */
    const valid = verifier.checkSignature(signedXml);

    return {
        valid,

        /*
         * 验证成功后，只返回真正被签名保护的 XML。
         *
         * 不应该在验证成功后直接信任原始 signedXml，
         * 因为原始 XML 可能还包含没有被签名的其他节点。
         */
        signedReferences: valid ? verifier.getSignedReferences() : [],
    };
}

/*
 * 4. 准备原始 XML
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
 * 5. OpenAM 使用私钥签名
 */
const signedXml = signXml(originalXml);

console.log("========== 签名后的 XML ==========");
console.log(signedXml);

/*
 * 6. JSL-online 使用公钥验证
 */
const originalResult = verifyXml(signedXml);

console.log("\n========== 原始 XML 验证 ==========");
console.log("验证结果：", originalResult.valid);

/*
 * 7. 模拟攻击者篡改用户权限
 */
const tamperedXml = signedXml.replace("<Role>user</Role>", "<Role>admin</Role>",);

console.log("\n========== 篡改后的 XML ==========");
console.log(tamperedXml);

/*
 * 8. 验证被篡改的 XML
 */
const tamperedResult = verifyXml(tamperedXml);

console.log("\n========== 篡改 XML 验证 ==========");
console.log("验证结果：", tamperedResult.valid);

/*
 * 9. 读取真正被签名保护的 XML
 */
console.log("\n========== 真正被签名的内容 ==========");

if (originalResult.valid) {
    console.log(originalResult.signedReferences[0]);
}