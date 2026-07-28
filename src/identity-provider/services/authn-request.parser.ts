import zlib from "node:zlib";
import { Injectable } from "@nestjs/common";
import { DOMParser } from "@xmldom/xmldom";
import xpath from "xpath";

export class InvalidAuthnRequestError extends Error {
    constructor(reason: string, options?: ErrorOptions) {
        super(`Cannot parse the AuthnRequest: ${reason}`, options);
        this.name = "InvalidAuthnRequestError";
    }
}

export interface ParsedAuthnRequest {
    readonly requestId: string;
    readonly serviceProviderEntityId: string;
}

/**
 * Translates the SAMLRequest parameter of the HTTP-Redirect binding into an internal
 * model. Wire format: SAMLRequest = base64(raw deflate(AuthnRequest XML)).
 *
 * This decodes the protocol and makes no business decision. Whether that SP is allowed
 * to log in is answered by the ServiceProviderRegistry.
 */
@Injectable()
export class AuthnRequestParser {
    parseRedirectBinding(samlRequestParam: string | undefined): ParsedAuthnRequest {
        const document = this.parseXml(this.inflate(samlRequestParam));

        const requestId = xpath.select1("string(/*[local-name(.)='AuthnRequest']/@ID)", document);
        const issuer = xpath.select1(
            "string(/*[local-name(.)='AuthnRequest']/*[local-name(.)='Issuer'])",
            document,
        );

        // Some implementations pretty-print their AuthnRequest, which would otherwise
        // leave newlines and indentation inside the entity ID and fail every lookup.
        const serviceProviderEntityId = String(issuer ?? "").trim();

        if (!requestId || !serviceProviderEntityId) {
            throw new InvalidAuthnRequestError("ID or Issuer is missing");
        }

        return Object.freeze({ requestId: String(requestId), serviceProviderEntityId });
    }

    private inflate(samlRequestParam: string | undefined): string {
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

    private parseXml(authnRequestXml: string): Document {
        /*
         * The parser reports malformed XML through onError and otherwise writes it to
         * the console. Turning it into a domain error keeps the failure on one path:
         * the exception filter answers 400 and logs the whole cause chain.
         */
        const onError = (level: string, message: string): void => {
            if (level === "fatalError") {
                throw new InvalidAuthnRequestError(`the decoded payload is not valid XML (${message})`);
            }
        };

        try {
            return new DOMParser({ onError }).parseFromString(
                authnRequestXml,
                "application/xml",
            ) as unknown as Document;
        } catch (error) {
            if (error instanceof InvalidAuthnRequestError) {
                throw error;
            }

            throw new InvalidAuthnRequestError("the decoded payload is not valid XML", { cause: error });
        }
    }
}
