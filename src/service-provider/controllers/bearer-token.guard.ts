import {CanActivate, createParamDecorator, ExecutionContext, Injectable, UnauthorizedException,} from "@nestjs/common";
import {Request} from "express";

import {AuthenticatedUser} from "../models/authenticated-user";
import {AccessTokenIssuer} from "../services/access-token";

interface AuthenticatedRequest extends Request {
    authenticatedUser?: AuthenticatedUser;
}

/**
 * Guards the SP's own API: the browser sends the access token it kept in localStorage
 * as `Authorization: Bearer <token>`.
 *
 * Because the token is self-contained there is no session store to consult — the
 * signature and the expiry are the whole answer.
 */
@Injectable()
export class BearerTokenGuard implements CanActivate {
    constructor(private readonly accessTokens: AccessTokenIssuer) {
    }

    canActivate(context: ExecutionContext): boolean {
        const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
        const token = readBearerToken(request.header("authorization"));

        if (!token) {
            throw new UnauthorizedException("Missing bearer token");
        }

        try {
            request.authenticatedUser = this.accessTokens.verify(token);
        } catch {
            // The reason (expired, wrong signature, malformed) is deliberately not
            // reported back: it would tell an attacker which part to fix.
            throw new UnauthorizedException("Invalid or expired access token");
        }

        return true;
    }
}

function readBearerToken(authorization: string | undefined): string | undefined {
    const [scheme, token] = (authorization ?? "").split(" ");

    return scheme?.toLowerCase() === "bearer" && token ? token : undefined;
}

/** Reads the user the guard attached, so a handler never touches the raw request. */
export const CurrentUser = createParamDecorator(
    (_data: unknown, context: ExecutionContext): AuthenticatedUser =>
        context.switchToHttp().getRequest<AuthenticatedRequest>().authenticatedUser!,
);
