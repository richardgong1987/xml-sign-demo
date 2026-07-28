import zlib from "node:zlib";
import { DOMParser } from "@xmldom/xmldom";
import xpath from "xpath";

export class InvalidAuthnRequestError extends Error {
    constructor(reason, options) {
        super(`Cannot parse the AuthnRequest: ${reason}`, options);
        this.name = "InvalidAuthnRequestError";
    }
}

/**
 * Translates the SAMLRequest parameter of the HTTP-Redirect binding into an
 * internal model.
 *
 * Wire format: SAMLRequest = base64(raw deflate(AuthnRequest XML))
 *
 * This is an adapter: it decodes the protocol and makes no business decision.
 * Whether that SP is allowed to log in is answered by the ServiceProviderRegistry.
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
        throw new InvalidAuthnRequestError("ID or Issuer is missing");
    }

    return Object.freeze({ requestId, serviceProviderEntityId });
}

function inflateAuthnRequest(samlRequestParam) {
    if (!samlRequestParam) {
        throw new InvalidAuthnRequestError("the SAMLRequest parameter is missing");
    }

    try {
        return zlib.inflateRawSync(Buffer.from(samlRequestParam, "base64")).toString("utf8");
    } catch (error) {
        // Attach the underlying failure as a cause so the log shows the whole chain
        // instead of a single hand-concatenated sentence.
        throw new InvalidAuthnRequestError("base64 or deflate decoding failed", { cause: error });
    }
}
