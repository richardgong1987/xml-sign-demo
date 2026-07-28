import {Body, Controller, Get, Header, Inject, Post, Query, Redirect, Render, Req, Res} from "@nestjs/common";
import {Request, Response} from "express";

import {SessionStore} from "../services/session-store";
import {CompleteSingleSignOnUseCase} from "../services/complete-single-sign-on.use-case";
import {StartSingleSignOnUseCase} from "../services/start-single-sign-on.use-case";
import {ProfilePageModel, toProfilePageModel} from "../presenters/sp.presenter";

export const SERVICE_PROVIDER_METADATA = Symbol("ServiceProviderMetadata");

const SESSION_COOKIE = "sp_session";

/*
 * The ACS receives a cross-site POST (a form served from the IdP's origin), so the
 * session cookie has to survive that navigation. SameSite=Lax still sends the cookie on
 * the top-level GET redirect that follows, while blocking cross-site writes.
 */
const SESSION_COOKIE_OPTIONS = Object.freeze({httpOnly: true, sameSite: "lax", path: "/"} as const);

interface AssertionConsumerForm {
    readonly SAMLResponse?: string;
    readonly RelayState?: string;
}

/** The SP's HTTP boundary. */
@Controller()
export class ServiceProviderController {
    constructor(
        private readonly startSingleSignOn: StartSingleSignOnUseCase,
        private readonly completeSingleSignOn: CompleteSingleSignOnUseCase,
        private readonly sessions: SessionStore,
        @Inject(SERVICE_PROVIDER_METADATA) private readonly metadataXml: string,
    ) {
    }

    @Get()
    @Render("home")
    showHomePage(): Record<string, never> {
        return {};
    }

    @Get("login")
    @Redirect()
    async startLogin(@Query("returnTo") returnTo = ""): Promise<{ url: string }> {
        return {url: await this.startSingleSignOn.execute({returnTo})};
    }

    @Get("api/saml/metadata")
    @Header("content-type", "application/xml")
    publishMetadata(): string {
        return this.metadataXml;
    }

    @Post("api/saml/acs")
    async consumeAssertion(@Body() form: AssertionConsumerForm, @Res() response: Response): Promise<void> {
        const {sessionId, returnTo} = await this.completeSingleSignOn.execute({
            samlResponse: form.SAMLResponse ?? "",
            relayState: form.RelayState ?? "",
        });

        response.cookie(SESSION_COOKIE, sessionId, SESSION_COOKIE_OPTIONS);
        response.redirect(returnTo);
    }

    /*
     * Rendering or redirecting depending on the session is the one place a handler
     * needs the raw response; everywhere else @Render and @Redirect suffice.
     */
    @Get("profile")
    showProfile(@Req() request: Request, @Res() response: Response): void {
        const user = this.sessions.find(request.cookies?.[SESSION_COOKIE]);

        if (!user) {
            response.redirect("/");
            return;
        }

        response.render("profile", toProfilePageModel(user) satisfies ProfilePageModel);
    }

    @Post("logout")
    signOut(@Req() request: Request, @Res() response: Response): void {
        this.sessions.remove(request.cookies?.[SESSION_COOKIE]);

        response.clearCookie(SESSION_COOKIE, SESSION_COOKIE_OPTIONS);
        response.redirect("/");
    }
}
