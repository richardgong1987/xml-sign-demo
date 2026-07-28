import { Injectable } from "@nestjs/common";

import { SamlGateway } from "./saml-gateway";

export interface StartSingleSignOnCommand {
    readonly returnTo: string;
}

/**
 * The SP starts single sign-on: it builds an AuthnRequest and sends the user to the IdP.
 *
 * The page the user wanted before signing in travels in RelayState. RelayState is
 * opaque to the IdP, which only echoes it back unchanged.
 */
@Injectable()
export class StartSingleSignOnUseCase {
    constructor(private readonly samlGateway: SamlGateway) {}

    /** @returns the IdP sign-in URL */
    async execute(command: StartSingleSignOnCommand): Promise<string> {
        return this.samlGateway.createLoginRedirectUrl(command.returnTo);
    }
}
