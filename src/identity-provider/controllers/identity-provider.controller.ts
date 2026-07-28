import { Body, Controller, Get, Header, Inject, Post, Query, Render } from "@nestjs/common";

import { UserDirectory } from "../models/user-directory";
import { AuthnRequestParser } from "../services/authn-request.parser";
import { IssueSamlResponseUseCase } from "../services/issue-saml-response.use-case";
import { tamperWithRole } from "../services/tampering.simulator";
import {
    AutoPostFormModel,
    LoginPageModel,
    toAutoPostFormModel,
    toLoginPageModel,
} from "../presenters/idp.presenter";

export const IDENTITY_PROVIDER_METADATA = Symbol("IdentityProviderMetadata");

interface SingleSignOnQuery {
    readonly SAMLRequest?: string;
    readonly RelayState?: string;
}

interface LoginForm {
    readonly uid?: string;
    readonly serviceProviderEntityId?: string;
    readonly authnRequestId?: string;
    readonly relayState?: string;
    readonly tamper?: string;
}

/**
 * The IdP's HTTP boundary. It does three things only: translate the input, call the
 * use case, hand the result to a presenter. @Render names the template, so no
 * controller ever touches the view engine.
 */
@Controller()
export class IdentityProviderController {
    constructor(
        private readonly issueSamlResponse: IssueSamlResponseUseCase,
        private readonly authnRequests: AuthnRequestParser,
        private readonly users: UserDirectory,
        @Inject(IDENTITY_PROVIDER_METADATA) private readonly metadataXml: string,
    ) {}

    @Get("idp/metadata")
    @Header("content-type", "application/xml")
    publishMetadata(): string {
        return this.metadataXml;
    }

    @Get("idp/sso")
    @Render("login")
    showLoginPage(@Query() query: SingleSignOnQuery): LoginPageModel {
        return toLoginPageModel({
            authnRequest: this.authnRequests.parseRedirectBinding(query.SAMLRequest),
            relayState: query.RelayState ?? "",
            users: this.users.list(),
        });
    }

    @Post("idp/login")
    @Render("auto-post")
    signIn(@Body() form: LoginForm): AutoPostFormModel {
        const issued = this.issueSamlResponse.execute({
            uid: form.uid ?? "",
            serviceProviderEntityId: form.serviceProviderEntityId ?? "",
            authnRequestId: form.authnRequestId ?? "",
        });

        return toAutoPostFormModel({
            assertionConsumerServiceUrl: issued.assertionConsumerServiceUrl,
            samlResponse: form.tamper === "on" ? tamperWithRole(issued.samlResponse) : issued.samlResponse,
            relayState: form.relayState ?? "",
        });
    }
}
