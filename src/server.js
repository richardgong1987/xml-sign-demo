import { DEFAULT_PORTS } from "./config.js";
import { startSamlDemo } from "./bootstrap.js";

async function main() {
    const demo = await startSamlDemo(DEFAULT_PORTS);

    printStartupBanner(demo);
}

function printStartupBanner({ identityProviderConfig, serviceProviderConfig, identityProvider }) {
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
