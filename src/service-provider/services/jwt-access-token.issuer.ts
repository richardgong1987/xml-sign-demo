import {Inject, Injectable} from "@nestjs/common";
import {JwtService} from "@nestjs/jwt";

import {SERVICE_PROVIDER_CONFIG, ServiceProviderConfig} from "../service-provider.config";
import {AuthenticatedUser, createAuthenticatedUser} from "../models/authenticated-user";
import {AccessTokenIssuer} from "./access-token";

interface AccessTokenClaims {
    readonly sub: string;
    readonly uid: string;
    readonly email: string;
    readonly role: string;
    readonly sessionIndex: string;
}

/**
 * Signs and verifies the SP's own JWTs.
 *
 * The token is symmetric (HS256) and signed with a secret only this application holds,
 * which is what makes it self-contained: no server-side session lookup is needed to
 * decide whether a request is authenticated.
 */
@Injectable()
export class JwtAccessTokenIssuer extends AccessTokenIssuer {
    constructor(
        private readonly jwt: JwtService,
        @Inject(SERVICE_PROVIDER_CONFIG) private readonly config: ServiceProviderConfig,
    ) {
        super();
    }

    issue(user: AuthenticatedUser): string {
        return this.jwt.sign(
            {
                sub: user.nameId,
                uid: user.uid,
                email: user.email,
                role: user.role,
                sessionIndex: user.sessionIndex,
            } satisfies AccessTokenClaims,
            {issuer: this.config.entityId, expiresIn: this.config.accessTokenLifetimeSeconds},
        );
    }

    verify(token: string): AuthenticatedUser {
        const claims = this.jwt.verify<AccessTokenClaims>(token, {issuer: this.config.entityId});

        return createAuthenticatedUser({
            nameId: claims.sub,
            uid: claims.uid,
            email: claims.email,
            role: claims.role,
            sessionIndex: claims.sessionIndex,
        });
    }
}
