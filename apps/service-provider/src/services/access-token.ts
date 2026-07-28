import {AuthenticatedUser} from "../domain/authenticated-user";

/**
 * A port for the SP's own access tokens.
 *
 * Once the SAML assertion has been validated it is converted into one of these, and no
 * request after that has to know anything about SAML.
 *
 * A plain interface rather than the abstract class the Nest version used: without a DI
 * container there is nothing that needs the type to survive compilation.
 */
export interface AccessTokenIssuer {
    issue(user: AuthenticatedUser): Promise<string>;

    /** @throws when the token is malformed, expired, or not signed by this SP. */
    verify(token: string): Promise<AuthenticatedUser>;
}
