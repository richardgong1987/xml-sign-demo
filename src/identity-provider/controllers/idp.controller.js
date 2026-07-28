import express from "express";

import { renderView } from "../../shared/utils/render-view.js";
import { listUsers } from "../models/user-directory.js";
import { parseRedirectBindingAuthnRequest } from "../services/authn-request.parser.js";
import { toLoginPageView, toAutoPostFormView } from "../presenters/idp.presenter.js";
import { tamperWithRole } from "../services/tampering.simulator.js";

/**
 * The IdP's HTTP boundary. It does three things only: translate the input, call the
 * use case, hand the result to a presenter.
 *
 * @param {{ issueSamlResponse: { execute: Function }, metadataXml: string }} dependencies
 */
export function createIdentityProviderRouter({ issueSamlResponse, metadataXml }) {
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

