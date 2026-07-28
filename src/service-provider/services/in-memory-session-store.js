import crypto from "node:crypto";

/**
 * SessionStorePort implementation.
 *
 * An in-process Map: sessions are lost on restart and cannot be shared across
 * instances. Replacing it with Redis or a database requires no change to the use cases.
 */
export function createInMemorySessionStore() {
    const usersBySessionId = new Map();

    return Object.freeze({
        create(authenticatedUser) {
            const sessionId = crypto.randomUUID();
            usersBySessionId.set(sessionId, authenticatedUser);

            return sessionId;
        },

        // A missing session is a normal state (not signed in, expired), not an error.
        find(sessionId) {
            return usersBySessionId.get(sessionId) ?? null;
        },

        remove(sessionId) {
            usersBySessionId.delete(sessionId);
        },
    });
}
