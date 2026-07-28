import express from "express";

import { renderView } from "../../shared/utils/render-view.js";
import { toHomePageView, toProfilePageView } from "../presenters/sp.presenter.js";

const SESSION_COOKIE = "sp_session";

/*
 * The ACS receives a cross-site POST (a form served from the IdP's origin), so the
 * session cookie has to survive that navigation. SameSite=Lax still sends the cookie
 * on the top-level GET redirect that follows, while blocking cross-site writes.
 */
const SESSION_COOKIE_OPTIONS = Object.freeze({ httpOnly: true, sameSite: "lax", path: "/" });

/**
 * The SP's HTTP boundary.
 *
 * @param {{
 *   startSingleSignOn: { execute: Function },
 *   completeSingleSignOn: { execute: Function },
 *   sessionStore: { find: Function, remove: Function },
 *   metadataXml: string,
 * }} dependencies
 */
export function createServiceProviderRouter(dependencies) {
    const { startSingleSignOn, completeSingleSignOn, sessionStore, metadataXml } = dependencies;
    const router = express.Router();

    router.get("/", (request, response) => {
        renderView(response, toHomePageView());
    });

    router.get("/login", async (request, response) => {
        const returnTo = String(request.query.returnTo ?? "");

        response.redirect(await startSingleSignOn.execute({ returnTo }));
    });

    router.get("/api/saml/metadata", (request, response) => {
        response.type("application/xml").send(metadataXml);
    });

    router.post("/api/saml/acs", async (request, response) => {
        const { sessionId, returnTo } = await completeSingleSignOn.execute({
            samlResponse: String(request.body.SAMLResponse ?? ""),
            relayState: String(request.body.RelayState ?? ""),
        });

        response.cookie(SESSION_COOKIE, sessionId, SESSION_COOKIE_OPTIONS);
        response.redirect(returnTo);
    });

    router.get("/profile", (request, response) => {
        const authenticatedUser = sessionStore.find(request.cookies[SESSION_COOKIE]);

        if (!authenticatedUser) {
            response.redirect("/");
            return;
        }

        renderView(response, toProfilePageView(authenticatedUser));
    });

    router.post("/logout", (request, response) => {
        sessionStore.remove(request.cookies[SESSION_COOKIE]);

        response.clearCookie(SESSION_COOKIE, SESSION_COOKIE_OPTIONS);
        response.redirect("/");
    });

    return router;
}

