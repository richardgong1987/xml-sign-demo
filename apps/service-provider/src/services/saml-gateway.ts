import {AuthenticatedUser} from "../domain/authenticated-user";

/**
 * A port covering everything the SP needs from the SAML protocol itself.
 *
 * The use cases depend on this interface, so they never import
 * @node-saml/node-saml and can be tested without any XML at all.
 */
export interface SamlGateway {
    createLoginRedirectUrl(relayState: string): Promise<string>;

    validateSamlResponse(samlResponseBase64: string): Promise<AuthenticatedUser>;

    describeMetadata(): string;
}
