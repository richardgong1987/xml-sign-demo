import {randomBytes} from "node:crypto";

export const ACCESS_TOKEN_SECRET = Symbol("AccessTokenSecret");

/**
 * The secret the SP signs its own access tokens with.
 *
 * Production reads this from a secret manager and keeps it stable, so tokens survive a
 * deploy. This demo mints a random one on every start, which means a restart quietly
 * invalidates every token that is still in a browser's localStorage — acceptable here,
 * and a reminder that nothing about a JWT can be revoked ahead of its expiry.
 */
export function createDemoAccessTokenSecret(): string {
    return randomBytes(32).toString("base64url");
}
