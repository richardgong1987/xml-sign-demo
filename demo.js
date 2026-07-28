/*
 * @node-saml/node-saml + xml-crypto
 * =================================
 *
 * 这个 Demo 不启动 HTTP 服务，也不发送 HTTP 请求。
 *
 * 它在一个 Node.js 进程里模拟两个系统：
 *
 *   1. Nomura OpenAM（IdP）
 *      - 创建 SAMLResponse
 *      - 使用 IdP 私钥和 xml-crypto 签名 Assertion
 *
 *   2. JSL-online（SP）
 *      - 使用 IdP 公钥验证签名
 *      - 使用 @node-saml/node-saml 验证完整 SAML 规则
 *      - 取得已经认证的用户 Profile
 *
 * 请从 main() 开始阅读，再进入每个函数。
 */

import crypto from "node:crypto";
import { styleText } from "node:util";
import { SAML } from "@node-saml/node-saml";
import { DOMParser } from "@xmldom/xmldom";
import { SignedXml } from "xml-crypto";
import xpath from "xpath";

// ---------------------------------------------------------------------------
// 第一部分：双方约定的 SAML 配置
// ---------------------------------------------------------------------------

const SAML_CONFIG = Object.freeze({
    /*
     * IdP 的 Entity ID。
     * 表示这份登录结果由哪个身份提供者签发。
     */
    idpEntityId: "https://openam.example.test/idp",

    /*
     * SP 的 Entity ID。
     * OpenAM 会把它写入 Assertion 的 Audience。
     */
    spEntityId: "https://jsl-online.example.test/saml/metadata",

    /*
     * SP 的 ACS 地址。
     * 正式环境中，OpenAM 会把 SAMLResponse POST 到这里。
     *
     * 本 Demo 不会真的访问这个地址，只把它当作 SAML 字段进行验证。
     */
    acsUrl: "https://jsl-online.example.test/api/saml/acs",

    /*
     * IdP 的登录地址。
     * 本 Demo 不会访问它；这里只是为了让 node-saml 配置完整、易于映射到生产环境。
     */
    idpEntryPoint: "https://openam.example.test/saml/sso",
});

// ---------------------------------------------------------------------------
// 第二部分：模拟 OpenAM 持有的 RSA 密钥
// ---------------------------------------------------------------------------

/*
 * 正式环境不会在每次启动时生成密钥。
 *
 * 实际情况：
 *
 *   IdP 私钥：
 *     只保存在 Nomura OpenAM，绝对不能交给 JSL-online。
 *
 *   IdP 公钥证书：
 *     Nomura IAM/OpenAM 提供给 JSL-online。
 *     JSL-online 把它配置为 node-saml 的 idpCert。
 *
 * 为了让 Demo 完全独立运行，这里临时生成一对 RSA 密钥。
 */
const {
    privateKey: idpPrivateKey,
    publicKey: idpPublicKey,
} = crypto.generateKeyPairSync("rsa", {
    modulusLength: 2048,

    privateKeyEncoding: {
        type: "pkcs8",
        format: "pem",
    },

    publicKeyEncoding: {
        type: "spki",
        format: "pem",
    },
});

// ---------------------------------------------------------------------------
// 第三部分：假 OpenAM 创建一份尚未签名的 SAMLResponse
// ---------------------------------------------------------------------------

function createUnsignedSamlResponse() {
    const now = new Date();

    // 允许最多 5 秒的服务器时间差。
    const notBefore = new Date(now.getTime() - 5_000);

    // Assertion 5 分钟后失效。
    const notOnOrAfter = new Date(now.getTime() + 5 * 60_000);

    const responseId = createSamlId();
    const assertionId = createSamlId();
    const sessionIndex = createSamlId();

    /*
     * 为了突出重点，这是一份“最小但结构完整”的 SAMLResponse。
     *
     * 里面包含：
     *   - Response 的签发者、状态和接收地址
     *   - Assertion 的用户身份
     *   - 时间限制
     *   - Audience
     *   - 登录上下文
     *   - uid、email、role 三个用户属性
     */
    return `
<samlp:Response
    xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol"
    xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion"
    ID="${responseId}"
    Version="2.0"
    IssueInstant="${now.toISOString()}"
    Destination="${SAML_CONFIG.acsUrl}">

  <saml:Issuer>${SAML_CONFIG.idpEntityId}</saml:Issuer>

  <samlp:Status>
    <samlp:StatusCode
        Value="urn:oasis:names:tc:SAML:2.0:status:Success"/>
  </samlp:Status>

  <saml:Assertion
      ID="${assertionId}"
      Version="2.0"
      IssueInstant="${now.toISOString()}">

    <saml:Issuer>${SAML_CONFIG.idpEntityId}</saml:Issuer>

    <saml:Subject>
      <saml:NameID
          Format="urn:oasis:names:tc:SAML:1.1:nameid-format:unspecified">hanjin</saml:NameID>

      <saml:SubjectConfirmation
          Method="urn:oasis:names:tc:SAML:2.0:cm:bearer">
        <saml:SubjectConfirmationData
            Recipient="${SAML_CONFIG.acsUrl}"
            NotOnOrAfter="${notOnOrAfter.toISOString()}"/>
      </saml:SubjectConfirmation>
    </saml:Subject>

    <saml:Conditions
        NotBefore="${notBefore.toISOString()}"
        NotOnOrAfter="${notOnOrAfter.toISOString()}">
      <saml:AudienceRestriction>
        <saml:Audience>${SAML_CONFIG.spEntityId}</saml:Audience>
      </saml:AudienceRestriction>
    </saml:Conditions>

    <saml:AuthnStatement
        AuthnInstant="${now.toISOString()}"
        SessionIndex="${sessionIndex}">
      <saml:AuthnContext>
        <saml:AuthnContextClassRef>urn:oasis:names:tc:SAML:2.0:ac:classes:PasswordProtectedTransport</saml:AuthnContextClassRef>
      </saml:AuthnContext>
    </saml:AuthnStatement>

    <saml:AttributeStatement>
      <saml:Attribute Name="uid">
        <saml:AttributeValue
            xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
            xsi:type="xs:string"
            xmlns:xs="http://www.w3.org/2001/XMLSchema">hanjin</saml:AttributeValue>
      </saml:Attribute>

      <saml:Attribute Name="email">
        <saml:AttributeValue
            xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
            xsi:type="xs:string"
            xmlns:xs="http://www.w3.org/2001/XMLSchema">hanjin@example.test</saml:AttributeValue>
      </saml:Attribute>

      <saml:Attribute Name="role">
        <saml:AttributeValue
            xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
            xsi:type="xs:string"
            xmlns:xs="http://www.w3.org/2001/XMLSchema">trader</saml:AttributeValue>
      </saml:Attribute>
    </saml:AttributeStatement>

  </saml:Assertion>
</samlp:Response>`.trim();
}

// ---------------------------------------------------------------------------
// 第四部分：假 OpenAM 用 xml-crypto 签名 Assertion
// ---------------------------------------------------------------------------

function signAssertionWithXmlCrypto(unsignedSamlResponse) {
    /*
     * 这里明确直接使用 xml-crypto。
     *
     * 这段代码扮演的是 OpenAM：
     *   - privateKey 是 OpenAM 私钥
     *   - 要保护的内容是 <saml:Assertion>
     */
    const signer = new SignedXml({
        privateKey: idpPrivateKey,

        canonicalizationAlgorithm:
            "http://www.w3.org/2001/10/xml-exc-c14n#",

        signatureAlgorithm:
            "http://www.w3.org/2001/04/xmldsig-more#rsa-sha256",
    });

    /*
     * Reference 表示 Signature 保护哪个 XML 节点。
     *
     * 这里选择 Assertion，而不是整个 Response。
     */
    signer.addReference({
        xpath: "//*[local-name(.)='Assertion']",

        digestAlgorithm:
            "http://www.w3.org/2001/04/xmlenc#sha256",

        transforms: [
            /*
             * 计算 Assertion 的 Digest 时排除 <Signature> 自己。
             */
            "http://www.w3.org/2000/09/xmldsig#enveloped-signature",

            /*
             * 计算 Digest 之前，对 XML 进行 Exclusive Canonicalization。
             */
            "http://www.w3.org/2001/10/xml-exc-c14n#",
        ],
    });

    /*
     * 按照常见 SAML 格式，把 Signature 放在 Assertion 的 Issuer 后面。
     */
    signer.computeSignature(unsignedSamlResponse, {
        location: {
            reference:
                "//*[local-name(.)='Assertion']/*[local-name(.)='Issuer']",
            action: "after",
        },
    });

    return signer.getSignedXml();
}

// ---------------------------------------------------------------------------
// 第五部分：直接使用 xml-crypto 做低层验签
// ---------------------------------------------------------------------------

function verifyOnlyXmlSignature(signedSamlResponse) {
    /*
     * 这个函数只回答：
     *
     *   “Assertion 的 XML 数字签名是否合法？”
     *
     * 它不会验证：
     *   - Audience 是否是 JSL-online
     *   - Assertion 是否过期
     *   - Recipient 是否是正确 ACS
     *   - SAML Status 是否为 Success
     *
     * 这些 SAML 协议规则要交给 @node-saml/node-saml。
     */
    const document = new DOMParser().parseFromString(
        signedSamlResponse,
        "application/xml",
    );

    const signatureNode = xpath.select(
        `//*[local-name(.)='Assertion']
           /*[local-name(.)='Signature'
             and namespace-uri(.)='http://www.w3.org/2000/09/xmldsig#']`,
        document,
    )[0];

    if (!signatureNode) {
        throw new Error("Assertion 中没有找到 Signature");
    }

    const verifier = new SignedXml({
        /*
         * JSL-online 只需要 OpenAM 的公钥。
         * 不需要、也不应该拥有 OpenAM 私钥。
         */
        publicCert: idpPublicKey,
    });

    verifier.loadSignature(signatureNode);

    const valid = verifier.checkSignature(signedSamlResponse);

    return {
        valid,

        /*
         * 只有 getSignedReferences() 返回的内容，
         * 才是签名真正保护的 XML。
         */
        verifiedXml: valid
            ? verifier.getSignedReferences()[0]
            : null,
    };
}

// ---------------------------------------------------------------------------
// 第六部分：配置 JSL-online 的 @node-saml/node-saml
// ---------------------------------------------------------------------------

function createJslServiceProvider() {
    return new SAML({
        /*
         * OpenAM 登录地址。
         * 本 Demo 只验证 Response，不访问这个地址。
         */
        entryPoint: SAML_CONFIG.idpEntryPoint,

        /*
         * JSL-online 的 ACS 地址。
         */
        callbackUrl: SAML_CONFIG.acsUrl,

        /*
         * JSL-online 的 SP Entity ID。
         */
        issuer: SAML_CONFIG.spEntityId,

        /*
         * 最关键的配合点：
         *
         * node-saml 收到 idpCert 后，会在内部把它交给 xml-crypto，
         * 用来验证 OpenAM 私钥生成的 XML Signature。
         */
        idpCert: idpPublicKey,

        /*
         * Assertion 的 Audience 必须等于 JSL-online 的 Entity ID。
         */
        audience: SAML_CONFIG.spEntityId,

        /*
         * 本 Demo 签名的是 Assertion。
         */
        wantAssertionsSigned: true,

        /*
         * 本 Demo 没有签名最外层 Response，所以设为 false。
         *
         * 生产环境应严格按照 Nomura OpenAM 的实际签名策略配置。
         */
        wantAuthnResponseSigned: false,

        /*
         * 本 Demo 没有先发送 AuthnRequest，所以没有 InResponseTo。
         *
         * 生产环境如果是 SP-initiated SSO，通常建议使用 "always"。
         */
        validateInResponseTo: "never",

        /*
         * 允许双方服务器最多有 5 秒时间差。
         */
        acceptedClockSkewMs: 5_000,
    });
}

// ---------------------------------------------------------------------------
// 第七部分：使用 node-saml 验证完整 SAMLResponse
// ---------------------------------------------------------------------------

async function validateWithNodeSaml(serviceProvider, signedSamlResponse) {
    /*
     * HTTP POST 中的 SAMLResponse 本质上就是：
     *
     *   Base64(SAML XML)
     *
     * 本 Demo 不发送 HTTP 请求，直接构造相同的数据并调用方法。
     */
    const samlResponseBase64 = Buffer
        .from(signedSamlResponse, "utf8")
        .toString("base64");

    /*
     * node-saml 内部会：
     *
     *   1. Base64 解码
     *   2. 解析 XML
     *   3. 找到 Response 和 Assertion
     *   4. 把 idpCert 和 Signature 交给 xml-crypto
     *   5. 从 getSignedReferences() 取得真正被签名的 Assertion
     *   6. 验证 Recipient
     *   7. 验证 NotBefore / NotOnOrAfter
     *   8. 验证 Audience
     *   9. 解析 NameID 和 Attribute
     *  10. 返回 profile
     */
    return serviceProvider.validatePostResponseAsync({
        SAMLResponse: samlResponseBase64,
    });
}

// ---------------------------------------------------------------------------
// 第八部分：篡改测试
// ---------------------------------------------------------------------------

function tamperWithRole(signedSamlResponse) {
    /*
     * 攻击者把已签名的 role 从 trader 改成 administrator，
     * 但无法重新生成 OpenAM 私钥签名。
     */
    return signedSamlResponse.replace(
        ">trader</saml:AttributeValue>",
        ">administrator</saml:AttributeValue>",
    );
}

// ---------------------------------------------------------------------------
// 第九部分：程序入口
// ---------------------------------------------------------------------------

async function main() {
    printTitle("1. 假 OpenAM 创建未签名的 SAMLResponse");

    const unsignedSamlResponse = createUnsignedSamlResponse();

    console.log(summarizeAssertion(unsignedSamlResponse));

    printTitle("2. 假 OpenAM 使用 xml-crypto + IdP 私钥签名 Assertion");

    const signedSamlResponse =
        signAssertionWithXmlCrypto(unsignedSamlResponse);

    console.log("Signature 已加入 Assertion：", signedSamlResponse.includes("<Signature"));

    printTitle("3. JSL-online 直接使用 xml-crypto + IdP 公钥验签");

    const lowLevelResult =
        verifyOnlyXmlSignature(signedSamlResponse);

    console.log("XML 数字签名是否合法：", lowLevelResult.valid);
    console.log("\n真正被签名保护的 Assertion：");
    console.log(lowLevelResult.verifiedXml);

    printTitle("4. JSL-online 使用 @node-saml/node-saml 验证完整 SAMLResponse");

    const serviceProvider = createJslServiceProvider();

    const nodeSamlResult = await validateWithNodeSaml(
        serviceProvider,
        signedSamlResponse,
    );

    printAuthenticatedProfile(nodeSamlResult.profile);

    printTitle("5. 模拟攻击者把 role=trader 改成 role=administrator");

    const tamperedSamlResponse =
        tamperWithRole(signedSamlResponse);

    console.log("角色字段是否已被修改：", tamperedSamlResponse.includes(
        ">administrator</saml:AttributeValue>",
    ));

    const tamperedLowLevelResult =
        verifyOnlyXmlSignature(tamperedSamlResponse);

    console.log(
        "xml-crypto 对篡改内容的验证结果：",
        tamperedLowLevelResult.valid,
    );

    try {
        await validateWithNodeSaml(
            serviceProvider,
            tamperedSamlResponse,
        );

        console.log("错误：篡改后的 SAMLResponse 不应该验证成功");
        process.exitCode = 1;
    } catch (error) {
        console.log(
            "node-saml 对篡改内容的验证结果：失败（符合预期）",
        );
        console.log("失败原因：", error.message);
    }

    printTitle("6. 最终结论");

    console.log(`
xml-crypto：
  负责 XML Canonicalization、Digest 和 RSA 签名验证。

@node-saml/node-saml：
  内部调用 xml-crypto 验签；
  同时验证 Audience、Recipient、有效期等 SAML 规则；
  最后把已经认证的 Assertion 转换成用户 Profile。

JSL-online：
  拿到 Profile 后，再创建自己的 Session/JWT，并查询业务权限。
`.trim());
}

// ---------------------------------------------------------------------------
// 第十部分：只为提高输出可读性的辅助函数
// ---------------------------------------------------------------------------

function createSamlId() {
    return `_${crypto.randomUUID()}`;
}

function printTitle(title) {
    const rule = styleText("dim", "=".repeat(78));

    console.log(`\n${rule}`);
    console.log(styleText("bold", title));
    console.log(rule);
}

function summarizeAssertion(samlResponse) {
    const document = new DOMParser().parseFromString(
        samlResponse,
        "application/xml",
    );

    const nameId = xpath.select(
        "string(//*[local-name(.)='NameID'])",
        document,
    );

    const attributes = Object.fromEntries(
        xpath.select(
            "//*[local-name(.)='Attribute']",
            document,
        ).map((attributeNode) => {
            const name = attributeNode.getAttribute("Name");
            const value = xpath.select(
                "string(./*[local-name(.)='AttributeValue'])",
                attributeNode,
            );

            return [name, value];
        }),
    );

    return [
        `NameID : ${nameId}`,
        `uid    : ${attributes.uid}`,
        `email  : ${attributes.email}`,
        `role   : ${attributes.role}`,
    ].join("\n");
}

function printAuthenticatedProfile(profile) {
    if (!profile) {
        throw new Error("node-saml 没有返回用户 Profile");
    }

    console.log("SAML 验证成功：true");
    console.log("\nnode-saml 返回的认证用户：");
    console.log("nameID       :", profile.nameID);
    console.log("uid          :", profile.uid);
    console.log("email        :", profile.email);
    console.log("role         :", profile.role);
    console.log("sessionIndex :", profile.sessionIndex);
}

// ESM 顶层 await：失败时由 Node 直接报错并以非零码退出。
await main();
