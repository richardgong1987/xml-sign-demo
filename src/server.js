"use strict";

const { identityProviderConfig, serviceProviderConfig } = require("./config");
const { createDemoSigningCredential } = require("./shared/demo-signing-credential");
const { createIdentityProviderApp } = require("./features/identity-provider");
const { createServiceProviderApp } = require("./features/service-provider");
const { fetchIdentityProviderMetadata } = require("./features/service-provider/idp-metadata.client");

/**
 * 组装根。
 *
 * 顺序本身就是 SAML 的信任建立顺序：
 *   IdP 先持有私钥并公布 metadata，SP 才能从 metadata 里导入证书。
 */
async function main() {
    const signingCredential = await createDemoSigningCredential("Demo OpenAM Signing");

    await startHttpServer({
        app: createIdentityProviderApp({ config: identityProviderConfig, signingCredential }),
        port: identityProviderConfig.port,
    });

    const identityProvider = await fetchIdentityProviderMetadata(
        serviceProviderConfig.identityProviderMetadataUrl,
    );

    await startHttpServer({
        app: createServiceProviderApp({ config: serviceProviderConfig, identityProvider }),
        port: serviceProviderConfig.port,
    });

    printStartupBanner(identityProvider);
}

function startHttpServer({ app, port }) {
    return new Promise((resolve, reject) => {
        const server = app.listen(port, () => resolve(server));
        server.on("error", reject);
    });
}

function printStartupBanner(identityProvider) {
    console.log(`
IdP（Demo OpenAM）  http://localhost:${identityProviderConfig.port}
  GET  /idp/metadata          IdP metadata（含签名证书）
  GET  /idp/sso               接收 AuthnRequest，显示登录页
  POST /idp/login             签发已签名的 SAMLResponse

SP（JSL-online）    http://localhost:${serviceProviderConfig.port}
  GET  /login                 发起 SSO
  GET  /api/saml/metadata     SP metadata
  POST /api/saml/acs          校验 SAMLResponse 并建立会话
  GET  /profile               显示已登录用户

SP 已从 ${identityProvider.entityId} 导入 IdP 签名证书。

打开 http://localhost:${serviceProviderConfig.port} 开始。
`.trim());
}

main().catch((error) => {
    console.error("启动失败：", error);
    process.exitCode = 1;
});
