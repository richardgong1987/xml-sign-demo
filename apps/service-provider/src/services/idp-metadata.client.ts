import {DOMParser} from "@xmldom/xmldom";
import xpath from "xpath";

import {toCertificatePem} from "../shared/x509-certificate";

const REDIRECT_BINDING = "urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect";
const METADATA_FETCH_TIMEOUT_MS = 5_000;

export interface IdentityProviderTrust {
    readonly entityId: string;
    readonly singleSignOnUrl: string;
    readonly signingCertificatePem: string;
}

/**
 * The SP imports its trust configuration from the IdP metadata.
 *
 * In reality this step is usually manual: the IAM team hands the metadata file to the
 * SP. Fetching it over HTTP here makes "where trust comes from" visible in the demo.
 */
export async function fetchIdentityProviderTrust(metadataUrl: string): Promise<IdentityProviderTrust> {
    let response: Response;

    try {
        // Don't hang forever when the IdP is down — the reason would be hard to see.
        response = await fetch(metadataUrl, {signal: AbortSignal.timeout(METADATA_FETCH_TIMEOUT_MS)});
    } catch (error) {
        throw new Error(`Cannot read the IdP metadata: ${metadataUrl} is unreachable`, {cause: error});
    }

    if (!response.ok) {
        throw new Error(`Cannot read the IdP metadata: ${metadataUrl} returned ${response.status}`);
    }

    return parseIdentityProviderTrust(await response.text());
}

export function parseIdentityProviderTrust(metadataXml: string): IdentityProviderTrust {
    const document = new DOMParser().parseFromString(metadataXml, "application/xml") as unknown as Node;

    const entityId = read(document, "string(/*[local-name(.)='EntityDescriptor']/@entityID)");
    const singleSignOnUrl = read(
        document,
        `string(//*[local-name(.)='SingleSignOnService'][@Binding='${REDIRECT_BINDING}']/@Location)`,
    );
    const certificateBody = read(document, "string(//*[local-name(.)='X509Certificate'])");

    if (!entityId || !singleSignOnUrl || !certificateBody) {
        throw new Error(
            "The IdP metadata is missing entityID, SingleSignOnService, or the signing certificate",
        );
    }

    return Object.freeze({
        entityId,
        singleSignOnUrl,
        signingCertificatePem: toCertificatePem(certificateBody),
    });
}

function read(document: Node, expression: string): string {
    return String(xpath.select1(expression, document) ?? "").trim();
}
