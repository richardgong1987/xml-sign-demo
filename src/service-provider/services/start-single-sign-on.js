/**
 * @typedef {{
 *   createLoginRedirectUrl: (relayState: string) => Promise<string>,
 *   validateSamlResponse: (samlResponseBase64: string) => Promise<object>,
 *   describeMetadata: () => string,
 * }} SamlGatewayPort
 */

/**
 * The SP starts single sign-on: it builds an AuthnRequest and sends the user to the IdP.
 *
 * The page the user wanted before signing in travels in RelayState. RelayState is
 * opaque to the IdP, which only echoes it back unchanged.
 */
export class StartSingleSignOnUseCase {
    #samlGateway;

    /** @param {{ samlGateway: SamlGatewayPort }} dependencies */
    constructor(dependencies) {
        this.#samlGateway = dependencies.samlGateway;
    }

    /**
     * @param {{ returnTo: string }} command
     * @returns {Promise<string>} the IdP sign-in URL
     */
    async execute(command) {
        return this.#samlGateway.createLoginRedirectUrl(command.returnTo);
    }
}
