import {randomUUID} from "node:crypto";
import {Injectable} from "@nestjs/common";

import {AuthenticatedUser} from "../models/authenticated-user";

/**
 * A port for the SP's own sessions, which have nothing to do with SAML any more.
 */
export abstract class SessionStore {
    abstract create(user: AuthenticatedUser): string;

    abstract find(sessionId: string | undefined): AuthenticatedUser | null;

    abstract remove(sessionId: string | undefined): void;
}

/**
 * An in-process Map: sessions are lost on restart and cannot be shared across
 * instances. Replacing it with Redis or a database requires no change to the use cases,
 * only a different binding in the module.
 */
@Injectable()
export class InMemorySessionStore extends SessionStore {
    private readonly usersBySessionId = new Map<string, AuthenticatedUser>();

    create(user: AuthenticatedUser): string {
        const sessionId = randomUUID();
        this.usersBySessionId.set(sessionId, user);

        return sessionId;
    }

    // A missing session is a normal state (not signed in, expired), not an error.
    find(sessionId: string | undefined): AuthenticatedUser | null {
        return (sessionId && this.usersBySessionId.get(sessionId)) || null;
    }

    remove(sessionId: string | undefined): void {
        if (sessionId) {
            this.usersBySessionId.delete(sessionId);
        }
    }
}
