import { Injectable } from "@nestjs/common";

export interface DirectoryUser {
    readonly uid: string;
    readonly email: string;
    readonly role: string;
}

export class UnknownUserError extends Error {
    constructor(uid: string) {
        super(`The IdP cannot authenticate an unknown user: ${uid}`);
        this.name = "UnknownUserError";
    }
}

/*
 * The IdP's user directory. In production this is LDAP or the OpenAM identity store;
 * here it is a constant so the demo depends on no external system.
 *
 * A Map rather than an object literal, so that a lookup can never reach a prototype
 * member such as "toString" or "constructor".
 */
const DEMO_USERS: readonly DirectoryUser[] = Object.freeze([
    Object.freeze({ uid: "hanjin", email: "hanjin@example.test", role: "trader" }),
    Object.freeze({ uid: "sakura", email: "sakura@example.test", role: "auditor" }),
]);

@Injectable()
export class UserDirectory {
    private readonly usersByUid = new Map(DEMO_USERS.map((user) => [user.uid, user]));

    list(): readonly DirectoryUser[] {
        return DEMO_USERS;
    }

    find(uid: string): DirectoryUser {
        const user = this.usersByUid.get(uid);

        if (!user) {
            throw new UnknownUserError(uid);
        }

        return user;
    }
}
