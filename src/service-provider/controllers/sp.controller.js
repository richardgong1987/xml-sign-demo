"use strict";

const express = require("express");

const { renderView } = require("../../shared/utils/render-view");
const { toHomePageView, toProfilePageView } = require("../presenters/sp.presenter");

const SESSION_COOKIE = "sp_session";

/*
 * ACS 是跨站 POST（来自 IdP 域的表单），会话 Cookie 必须允许在这种导航中生效。
 * SameSite=Lax 让随后的顶层 GET 跳转仍然带上 Cookie，同时挡住跨站的写请求。
 */
const SESSION_COOKIE_OPTIONS = Object.freeze({ httpOnly: true, sameSite: "lax", path: "/" });

/**
 * SP 的 HTTP 边界。
 *
 * @param {{
 *   startSingleSignOn: { execute: Function },
 *   completeSingleSignOn: { execute: Function },
 *   sessionStore: { find: Function, remove: Function },
 *   metadataXml: string,
 * }} dependencies
 */
function createServiceProviderRouter(dependencies) {
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

module.exports = { createServiceProviderRouter };
