import {DirectoryUser} from "../models/user-directory";
import {ParsedAuthnRequest} from "../services/authn-request.parser";

/*
 * A presenter turns a use-case result into exactly the data one template needs.
 * The HTML lives in the EJS templates under views/, and EJS's <%= %> does the escaping.
 */

export interface LoginPageModel {
    readonly authnRequestId: string;
    readonly serviceProviderEntityId: string;
    readonly relayState: string;
    readonly users: readonly DirectoryUser[];
}

export interface AutoPostFormModel {
    readonly assertionConsumerServiceUrl: string;
    readonly samlResponseBase64: string;
    readonly relayState: string;
}

/**
 * The IdP login page.
 *
 * The AuthnRequest context is carried to the next step in hidden fields. Production
 * should keep it in the IdP's own session so the user cannot rewrite it; exposing it
 * here makes the flow visible at a glance.
 */
export function toLoginPageModel(input: {
    authnRequest: ParsedAuthnRequest;
    relayState: string;
    users: readonly DirectoryUser[];
}): LoginPageModel {
    return {
        authnRequestId: input.authnRequest.requestId,
        serviceProviderEntityId: input.authnRequest.serviceProviderEntityId,
        relayState: input.relayState,
        users: input.users,
    };
}

/**
 * HTTP-POST binding: the IdP cannot call the SP directly, so it returns a
 * self-submitting form and lets the browser POST the SAMLResponse to the SP's ACS.
 */
export function toAutoPostFormModel(input: {
    assertionConsumerServiceUrl: string;
    samlResponse: string;
    relayState: string;
}): AutoPostFormModel {
    return {
        assertionConsumerServiceUrl: input.assertionConsumerServiceUrl,
        // The HTTP-POST binding transports the SAMLResponse base64-encoded.
        samlResponseBase64: Buffer.from(input.samlResponse, "utf8").toString("base64"),
        relayState: input.relayState,
    };
}
