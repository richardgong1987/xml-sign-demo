import {
    Body,
    Controller,
    Get,
    Header,
    HttpCode,
    Inject,
    Post,
    Query,
    Redirect,
    Render,
    UseGuards,
} from "@nestjs/common";

import {AuthenticatedUser} from "../models/authenticated-user";
import {CompleteSingleSignOnUseCase} from "../services/complete-single-sign-on.use-case";
import {StartSingleSignOnUseCase} from "../services/start-single-sign-on.use-case";
import {ProfileResponse, TokenHandoffModel, toProfileResponse} from "../presenters/sp.presenter";
import {BearerTokenGuard, CurrentUser} from "./bearer-token.guard";

export const SERVICE_PROVIDER_METADATA = Symbol("ServiceProviderMetadata");

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

    /*
     * The IdP POSTs here from its own origin, so this response cannot write to the SP's
     * localStorage itself. It renders a hand-off page instead: a script on the SP origin
     * stores the token and replaces the location with wherever the user was headed.
     */
    @Post("api/saml/acs")
    // A rendered page, not a created resource — Nest would answer 201 by default.
    @HttpCode(200)
    @Render("store-token")
    async consumeAssertion(@Body() form: AssertionConsumerForm): Promise<TokenHandoffModel> {
        return this.completeSingleSignOn.execute({
            samlResponse: form.SAMLResponse ?? "",
            relayState: form.RelayState ?? "",
        });
    }

    /*
     * Only a shell: the server has no idea whether this browser is signed in. The page's
     * script reads the token and asks /api/me.
     */
    @Get("profile")
    @Render("profile")
    showProfilePage(): Record<string, never> {
        return {};
    }

    @Get("api/me")
    @UseGuards(BearerTokenGuard)
    describeSignedInUser(@CurrentUser() user: AuthenticatedUser): ProfileResponse {
        return toProfileResponse(user);
    }
}
