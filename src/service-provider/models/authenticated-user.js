export class InvalidAuthenticatedUserError extends Error {
    constructor(reason) {
        super(`The SAML assertion cannot be turned into a signed-in user: ${reason}`);
        this.name = "InvalidAuthenticatedUserError";
    }
}

/**
 * A user the SP has accepted as signed in.
 *
 * Data reaching this point has already passed the signature and SAML protocol
 * checks, so it is a trustworthy starting point for the SP's own session. The SP
 * still decides its own authorization; the role the IdP asserts is only an input.
 *
 * @param {{ nameId: string, uid: string, email: string, role: string, sessionIndex: string }} params
 */
export function createAuthenticatedUser(params) {
    if (!params.nameId) {
        throw new InvalidAuthenticatedUserError("NameID is missing");
    }

    return Object.freeze({ ...params });
}
