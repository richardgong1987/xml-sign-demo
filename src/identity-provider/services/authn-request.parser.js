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
    const document = parseXml(inflateAuthnRequest(samlRequestParam));

    const requestId = xpath.select("string(/*[local-name(.)='AuthnRequest']/@ID)", document);
    const serviceProviderEntityId = xpath
        .select("string(/*[local-name(.)='AuthnRequest']/*[local-name(.)='Issuer'])", document)
        // Some implementations pretty-print their AuthnRequest, which would otherwise
        // leave newlines and indentation inside the entity ID and fail every lookup.
        .trim();

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

function parseXml(authnRequestXml) {
    /*
     * The parser reports malformed XML through onError and otherwise writes it to the
     * console. Turning it into a domain error keeps the failure on one path: the HTTP
     * boundary answers 400 and the log carries the whole cause chain.
     */
    const onError = (level, message) => {
        if (level === "fatalError") {
            throw new InvalidAuthnRequestError(`the decoded payload is not valid XML (${message})`);
        }
    };

    try {
        return new DOMParser({ onError }).parseFromString(authnRequestXml, "application/xml");
    } catch (error) {
        if (error instanceof InvalidAuthnRequestError) {
            throw error;
        }

        throw new InvalidAuthnRequestError("the decoded payload is not valid XML", { cause: error });
    }
}
