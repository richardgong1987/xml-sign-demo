import {SignJWT, jwtVerify} from "jose";

import {ServiceProviderConfig} from "../config/service-provider.config";
import {AuthenticatedUser, createAuthenticatedUser} from "../domain/authenticated-user";
import {AccessTokenIssuer} from "./access-token";

const ALGORITHM = "HS256";

/**
 * Signs and verifies the SP's own JWTs with `jose`.
 *
 * The token is symmetric and signed with a secret only this application holds, which is
 * what makes it self-contained: no server-side session lookup is needed to decide
 * whether a request is authenticated.
 */
export function createJoseAccessTokenIssuer(config: ServiceProviderConfig): AccessTokenIssuer {
    return {
        async issue(user: AuthenticatedUser): Promise<string> {
            return new SignJWT({
                uid: user.uid,
                email: user.email,
                role: user.role,
                sessionIndex: user.sessionIndex,
            })
                .setProtectedHeader({alg: ALGORITHM})
                .setSubject(user.nameId)
                .setIssuer(config.entityId)
                .setIssuedAt()
                .setExpirationTime(`${config.accessTokenLifetimeSeconds}s`)
                .sign(config.accessTokenSecret);
        },

        async verify(token: string): Promise<AuthenticatedUser> {
            const {payload} = await jwtVerify(token, config.accessTokenSecret, {
                // Pin the algorithm. Trusting whatever the token's own header claims is
                // the classic JWT confusion bug.
                algorithms: [ALGORITHM],
                issuer: config.entityId,
            });

            return createAuthenticatedUser({
                nameId: String(payload.sub ?? ""),
                uid: String(payload.uid ?? ""),
                email: String(payload.email ?? ""),
                role: String(payload.role ?? ""),
                sessionIndex: String(payload.sessionIndex ?? ""),
            });
        },
    };
}
