export class InvalidAuthenticatedUserError extends Error {
    constructor(reason: string) {
        super(`The SAML assertion cannot be turned into a signed-in user: ${reason}`);
        this.name = "InvalidAuthenticatedUserError";
    }
}

export interface AuthenticatedUser {
    readonly nameId: string;
    readonly uid: string;
    readonly email: string;
    readonly role: string;
}

/**
 * A user the SP has accepted as signed in.
 *
 * Data reaching this point has already passed the signature and SAML protocol checks,
 * so it is a trustworthy starting point for the SP's own session. The SP still decides
 * its own authorization; the role the IdP asserts is only an input.
 */
export function createAuthenticatedUser(user: AuthenticatedUser): AuthenticatedUser {
    if (!user.nameId) {
        throw new InvalidAuthenticatedUserError("NameID is missing");
    }

    return Object.freeze({...user});
}
