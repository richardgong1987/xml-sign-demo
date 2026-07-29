import {jwtVerify, SignJWT} from "jose";

import {ServiceProviderConfig} from "../config/service-provider.config";
import {AuthenticatedUser, createAuthenticatedUser} from "../domain/authenticated-user";

const ALGORITHM = "HS256";

/**
 * Everything JWT: signing a token for a user who has just authenticated, and verifying
 * one that arrives on a later request.
 *
 * Stateless on purpose. The secret, the issuer and the lifetime all come from config,
 * which is passed in rather than read from the environment here — that is what lets a
 * test sign with one secret and verify with another.
 *
 * The token is symmetric and signed with a secret only this application holds, which is
 * what makes it self-contained: no server-side session lookup is needed to decide
 * whether a request is authenticated.
 */
export class JwtUtil {
    static async sign(config: ServiceProviderConfig, user: AuthenticatedUser): Promise<string> {
        return new SignJWT({
            uid: user.uid,
            email: user.email,
            role: user.role,
        })
            .setProtectedHeader({alg: ALGORITHM})
            .setSubject(user.nameId)
            .setIssuer(config.entityId)
            .setIssuedAt()
            .setExpirationTime(`${config.accessTokenLifetimeSeconds}s`)
            .sign(config.accessTokenSecret);
    }

    /** @throws when the token is malformed, expired, or not signed by this SP. */
    static async verify(config: ServiceProviderConfig, token: string): Promise<AuthenticatedUser> {
        const {payload} = await jwtVerify(token, config.accessTokenSecret, {
            // Pin the algorithm. Trusting whatever the token's own header claims is the
            // classic JWT confusion bug.
            algorithms: [ALGORITHM],
            issuer: config.entityId,
        });

        return createAuthenticatedUser({
            nameId: String(payload.sub ?? ""),
            uid: String(payload.uid ?? ""),
            email: String(payload.email ?? ""),
            role: String(payload.role ?? ""),
        });
    }
}
