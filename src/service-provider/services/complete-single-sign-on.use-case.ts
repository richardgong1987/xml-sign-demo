import {Injectable} from "@nestjs/common";

import {SamlGateway} from "./saml-gateway";
import {SessionStore} from "./session-store";

const DEFAULT_LANDING_PAGE = "/profile";

export interface CompleteSingleSignOnCommand {
    readonly samlResponse: string;
    readonly relayState: string;
}

export interface CompletedSingleSignOn {
    readonly sessionId: string;
    readonly returnTo: string;
}

/**
 * The SP validates the SAMLResponse the IdP issued and opens a local session for the
 * user it describes.
 *
 * This is where trust is converted: the SAML assertion becomes the SP's own session,
 * and no request after this one has to know anything about SAML.
 */
@Injectable()
export class CompleteSingleSignOnUseCase {
    constructor(
        private readonly samlGateway: SamlGateway,
        private readonly sessions: SessionStore,
    ) {
    }

    async execute(command: CompleteSingleSignOnCommand): Promise<CompletedSingleSignOn> {
        const authenticatedUser = await this.samlGateway.validateSamlResponse(command.samlResponse);

        return {
            sessionId: this.sessions.create(authenticatedUser),
            returnTo: toSafeLandingPage(command.relayState),
        };
    }
}

/*
 * RelayState arrives from outside and becomes a redirect target verbatim. Only local
 * paths are accepted; otherwise the IdP — or an attacker — could send a freshly
 * signed-in user to any site at all.
 */
function toSafeLandingPage(relayState: string): string {
    const isLocalPath = relayState.startsWith("/") && !relayState.startsWith("//");

    return isLocalPath ? relayState : DEFAULT_LANDING_PAGE;
}
