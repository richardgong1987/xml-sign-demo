import { AuthenticatedUser } from "../models/authenticated-user";

/**
 * A port covering everything the SP needs from the SAML protocol itself.
 *
 * The use cases depend on this abstract class, so they never import
 * @node-saml/node-saml and can be tested without any XML at all.
 */
export abstract class SamlGateway {
    abstract createLoginRedirectUrl(relayState: string): Promise<string>;
    abstract validateSamlResponse(samlResponseBase64: string): Promise<AuthenticatedUser>;
    abstract describeMetadata(): string;
}
