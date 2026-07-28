import {AuthenticatedUser} from "../models/authenticated-user";

/**
 * A port for the SP's own access tokens.
 *
 * Once the SAML assertion has been validated it is converted into one of these, and no
 * request after that has to know anything about SAML. The use case depends on this
 * abstraction, so it can be tested without signing or verifying anything.
 */
export abstract class AccessTokenIssuer {
    abstract issue(user: AuthenticatedUser): string;

    /** @throws when the token is missing, malformed, expired, or not signed by this SP. */
    abstract verify(token: string): AuthenticatedUser;
}
