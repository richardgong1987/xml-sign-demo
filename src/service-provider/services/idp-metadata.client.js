import { DOMParser } from "@xmldom/xmldom";
import xpath from "xpath";

import { toCertificatePem } from "../../shared/utils/x509-certificate.js";

const REDIRECT_BINDING = "urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect";

const METADATA_FETCH_TIMEOUT_MS = 5_000;

/**
 * SP 启动时从 IdP metadata 导入信任配置。
 *
 * 现实中这一步往往是人工的：IAM 团队把 metadata 文件发给 SP。
 * 这里改成 HTTP 抓取，是为了让“信任从哪里来”在 Demo 里看得见。
 *
 * @param {string} metadataUrl
 * @returns {Promise<{ entityId: string, singleSignOnUrl: string, signingCertificatePem: string }>}
 */
export async function fetchIdentityProviderMetadata(metadataUrl) {
    let response;

    try {
        // IdP 没起来时不要让 SP 一直挂着，否则启动失败的原因很难看出来。
        response = await fetch(metadataUrl, { signal: AbortSignal.timeout(METADATA_FETCH_TIMEOUT_MS) });
    } catch (error) {
        throw new Error(`读取 IdP metadata 失败：无法访问 ${metadataUrl}`, { cause: error });
    }

    if (!response.ok) {
        throw new Error(`读取 IdP metadata 失败：${metadataUrl} 返回 ${response.status}`);
    }

    return parseIdentityProviderMetadata(await response.text());
}

function parseIdentityProviderMetadata(metadataXml) {
    const document = new DOMParser().parseFromString(metadataXml, "application/xml");

    const entityId = xpath.select("string(/*[local-name(.)='EntityDescriptor']/@entityID)", document);
    const singleSignOnUrl = xpath.select(
        `string(//*[local-name(.)='SingleSignOnService'][@Binding='${REDIRECT_BINDING}']/@Location)`,
        document,
    );
    const certificateBody = xpath.select("string(//*[local-name(.)='X509Certificate'])", document).trim();

    if (!entityId || !singleSignOnUrl || !certificateBody) {
        throw new Error("IdP metadata 缺少 entityID、SingleSignOnService 或签名证书");
    }

    return Object.freeze({
        entityId,
        singleSignOnUrl,
        signingCertificatePem: toCertificatePem(certificateBody),
    });
}

