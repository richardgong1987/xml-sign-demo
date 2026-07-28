import zlib from "node:zlib";
import { DOMParser } from "@xmldom/xmldom";
import xpath from "xpath";

export class InvalidAuthnRequestError extends Error {
    constructor(reason) {
        super(`AuthnRequest 无法解析：${reason}`);
        this.name = "InvalidAuthnRequestError";
    }
}

/**
 * 把 HTTP-Redirect 绑定的 SAMLRequest 参数翻译成内部模型。
 *
 * 传输格式：SAMLRequest = base64(raw deflate(AuthnRequest XML))
 *
 * 这是 adapter：只负责协议解码，不做任何业务判断。
 * “这个 SP 能不能登录”由 ServiceProviderRegistry 回答。
 *
 * @param {string} samlRequestParam
 * @returns {{ requestId: string, serviceProviderEntityId: string }}
 */
export function parseRedirectBindingAuthnRequest(samlRequestParam) {
    const authnRequestXml = inflateAuthnRequest(samlRequestParam);
    const document = new DOMParser().parseFromString(authnRequestXml, "application/xml");

    const requestId = xpath.select("string(/*[local-name(.)='AuthnRequest']/@ID)", document);
    const serviceProviderEntityId = xpath.select(
        "string(/*[local-name(.)='AuthnRequest']/*[local-name(.)='Issuer'])",
        document,
    );

    if (!requestId || !serviceProviderEntityId) {
        throw new InvalidAuthnRequestError("缺少 ID 或 Issuer");
    }

    return Object.freeze({ requestId, serviceProviderEntityId });
}

function inflateAuthnRequest(samlRequestParam) {
    if (!samlRequestParam) {
        throw new InvalidAuthnRequestError("缺少 SAMLRequest 参数");
    }

    try {
        return zlib.inflateRawSync(Buffer.from(samlRequestParam, "base64")).toString("utf8");
    } catch (error) {
        throw new InvalidAuthnRequestError(`Base64 或 Deflate 解码失败（${error.message}）`);
    }
}

