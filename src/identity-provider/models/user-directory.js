/*
 * The IdP's user directory. In production this is LDAP or the OpenAM identity
 * store; here it is a constant so the demo depends on no external system.
 */

export class UnknownUserError extends Error {
    constructor(uid) {
        super(`The IdP cannot authenticate an unknown user: ${uid}`);
        this.name = "UnknownUserError";
    }
}

const USERS_BY_UID = Object.freeze({
    hanjin: Object.freeze({ uid: "hanjin", email: "hanjin@example.test", role: "trader" }),
    sakura: Object.freeze({ uid: "sakura", email: "sakura@example.test", role: "auditor" }),
});

export function listUsers() {
    return Object.values(USERS_BY_UID);
}

export function findUser(uid) {
    if (!Object.hasOwn(USERS_BY_UID, uid)) {
        throw new UnknownUserError(uid);
    }

    return USERS_BY_UID[uid];
}
