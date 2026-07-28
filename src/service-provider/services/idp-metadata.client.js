import { DOMParser } from "@xmldom/xmldom";
import xpath from "xpath";

import { toCertificatePem } from "../../shared/utils/x509-certificate.js";

const REDIRECT_BINDING = "urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect";

const METADATA_FETCH_TIMEOUT_MS = 5_000;

/**
 * The SP imports its trust configuration from the IdP metadata at startup.
 *
 * In reality this step is usually manual: the IAM team hands the metadata file to the
 * SP. Fetching it over HTTP here makes "where trust comes from" visible in the demo.
 *
 * @param {string} metadataUrl
 * @returns {Promise<{ entityId: string, singleSignOnUrl: string, signingCertificatePem: string }>}
 */
export async function fetchIdentityProviderMetadata(metadataUrl) {
    let response;

    try {
        // Don't let the SP hang forever when the IdP is down — the reason startup failed
        // would be very hard to see.
        response = await fetch(metadataUrl, { signal: AbortSignal.timeout(METADATA_FETCH_TIMEOUT_MS) });
    } catch (error) {
        throw new Error(`Cannot read the IdP metadata: ${metadataUrl} is unreachable`, { cause: error });
    }

    if (!response.ok) {
        throw new Error(`Cannot read the IdP metadata: ${metadataUrl} returned ${response.status}`);
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
        throw new Error("The IdP metadata is missing entityID, SingleSignOnService, or the signing certificate");
    }

    return Object.freeze({
        entityId,
        singleSignOnUrl,
        signingCertificatePem: toCertificatePem(certificateBody),
    });
}
