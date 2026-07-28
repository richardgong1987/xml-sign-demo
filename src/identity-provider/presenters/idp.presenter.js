/*
 * A presenter answers two questions only: which template, and what data it needs.
 * The HTML lives in the EJS templates under views/, and EJS's <%= %> does the escaping.
 */

/**
 * The IdP login page.
 *
 * The AuthnRequest context is carried to the next step in hidden fields. Production
 * should keep it in the IdP's own session so the user cannot rewrite it; exposing it
 * here makes the flow visible at a glance.
 */
export function toLoginPageView({ authnRequest, relayState, users }) {
    return {
        view: "login",
        model: {
            authnRequestId: authnRequest.requestId,
            serviceProviderEntityId: authnRequest.serviceProviderEntityId,
            relayState,
            users,
        },
    };
}

/**
 * HTTP-POST binding: the IdP cannot call the SP directly, so it returns a
 * self-submitting form and lets the browser POST the SAMLResponse to the SP's ACS.
 */
export function toAutoPostFormView({ assertionConsumerServiceUrl, samlResponse, relayState }) {
    return {
        view: "auto-post",
        model: {
            assertionConsumerServiceUrl,
            // The HTTP-POST binding transports the SAMLResponse base64-encoded.
            samlResponseBase64: Buffer.from(samlResponse, "utf8").toString("base64"),
            relayState,
        },
    };
}

