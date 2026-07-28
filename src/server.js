import { parseArgs, styleText } from "node:util";

import { DEFAULT_PORTS } from "./config.js";
import { startSamlDemo } from "./bootstrap.js";

/*
 * ESM 支持顶层 await，因此不需要再包一层 main()。
 * 启动失败时抛出的错误由 Node 打印并以非零码退出。
 */
const demo = await startSamlDemo(readPortsFromCommandLine());

console.log(renderStartupBanner(demo));

/*
 * 端口在 config 里本来就是参数，顺手用 node:util 的 parseArgs 暴露到命令行：
 *   npm start -- --idp-port 4001 --sp-port 5001
 */
function readPortsFromCommandLine() {
    const { values } = parseArgs({
        options: {
            "idp-port": { type: "string" },
            "sp-port": { type: "string" },
        },
    });

    return {
        identityProviderPort: Number(values["idp-port"] ?? DEFAULT_PORTS.identityProviderPort),
        serviceProviderPort: Number(values["sp-port"] ?? DEFAULT_PORTS.serviceProviderPort),
    };
}

function renderStartupBanner({ identityProviderConfig, serviceProviderConfig, identityProvider }) {
    const idpBaseUrl = `http://localhost:${identityProviderConfig.port}`;
    const spBaseUrl = `http://localhost:${serviceProviderConfig.port}`;

    return [
        heading("IdP（Demo OpenAM）", idpBaseUrl),
        route("GET ", "/idp/metadata", "IdP metadata（含签名证书）"),
        route("GET ", "/idp/sso", "接收 AuthnRequest，显示登录页"),
        route("POST", "/idp/login", "签发已签名的 SAMLResponse"),
        "",
        heading("SP（JSL-online）", spBaseUrl),
        route("GET ", "/login", "发起 SSO"),
        route("GET ", "/api/saml/metadata", "SP metadata"),
        route("POST", "/api/saml/acs", "校验 SAMLResponse 并建立会话"),
        route("GET ", "/profile", "显示已登录用户"),
        "",
        `SP 已从 ${identityProvider.entityId} 导入 IdP 签名证书。`,
        "",
        `打开 ${styleText(["cyan", "underline"], spBaseUrl)} 开始。`,
    ].join("\n");
}

function heading(name, baseUrl) {
    return `${styleText("bold", name)}  ${styleText("cyan", baseUrl)}`;
}

function route(method, path, description) {
    return `  ${styleText("green", method)} ${path.padEnd(22)} ${styleText("dim", description)}`;
}
