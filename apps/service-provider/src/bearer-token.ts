import {AuthenticatedUser} from "./domain/authenticated-user";
import {AccessTokenIssuer} from "./services/access-token";

/**
 * The browser sends the token it kept in localStorage as `Authorization: Bearer <jwt>`.
 *
 * Because the token is self-contained there is no session store to consult — the
 * signature and the expiry are the whole answer. Returns null rather than throwing so
 * a route handler can decide the status code.
 */
export async function readAuthenticatedUser(
    request: Request,
    accessTokens: AccessTokenIssuer,
): Promise<AuthenticatedUser | null> {
    const token = readBearerToken(request.headers.get("authorization"));

    if (!token) {
        return null;
    }

    try {
        return await accessTokens.verify(token);
    } catch {
        // The reason (expired, wrong signature, malformed) is deliberately not reported
        // back: it would tell an attacker which part to fix.
        return null;
    }
}

function readBearerToken(authorization: string | null): string | undefined {
    const [scheme, token] = (authorization ?? "").split(" ");

    return scheme?.toLowerCase() === "bearer" && token ? token : undefined;
}
