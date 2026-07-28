"use strict";

const express = require("express");

const { renderView } = require("../../shared/utils/render-view");
const { listUsers } = require("../models/user-directory");
const { parseRedirectBindingAuthnRequest } = require("../services/authn-request.parser");
const { toLoginPageView, toAutoPostFormView } = require("../presenters/idp.presenter");
const { tamperWithRole } = require("../services/tampering.simulator");

/**
 * IdP 的 HTTP 边界。只做三件事：翻译输入、调用 use case、交给 presenter。
 *
 * @param {{ issueSamlResponse: { execute: Function }, metadataXml: string }} dependencies
 */
function createIdentityProviderRouter({ issueSamlResponse, metadataXml }) {
    const router = express.Router();

    router.get("/idp/metadata", (request, response) => {
        response.type("application/xml").send(metadataXml);
    });

    router.get("/idp/sso", (request, response) => {
        const authnRequest = parseRedirectBindingAuthnRequest(request.query.SAMLRequest);

        renderView(
            response,
            toLoginPageView({
                authnRequest,
                relayState: request.query.RelayState ?? "",
                users: listUsers(),
            }),
        );
    });

    router.post("/idp/login", (request, response) => {
        const { assertionConsumerServiceUrl, samlResponse } = issueSamlResponse.execute(
            toIssueSamlResponseCommand(request.body),
        );

        renderView(
            response,
            toAutoPostFormView({
                assertionConsumerServiceUrl,
                samlResponse: isTamperRequested(request.body)
                    ? tamperWithRole(samlResponse)
                    : samlResponse,
                relayState: request.body.relayState ?? "",
            }),
        );
    });

    return router;
}

function toIssueSamlResponseCommand(formBody) {
    return Object.freeze({
        uid: String(formBody.uid ?? ""),
        serviceProviderEntityId: String(formBody.serviceProviderEntityId ?? ""),
        authnRequestId: String(formBody.authnRequestId ?? ""),
    });
}

function isTamperRequested(formBody) {
    return formBody.tamper === "on";
}

module.exports = { createIdentityProviderRouter };
