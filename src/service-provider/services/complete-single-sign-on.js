/**
 * @typedef {import("./start-single-sign-on.js").SamlGatewayPort} SamlGatewayPort
 * @typedef {{ create: (user: object) => string, find: (sessionId: string) => object | null }} SessionStorePort
 */

const DEFAULT_LANDING_PAGE = "/profile";

/**
 * The SP validates the SAMLResponse the IdP issued and opens a local session for the
 * user it describes.
 *
 * This is where trust is converted: the SAML assertion becomes the SP's own session,
 * and no request after this one has to know anything about SAML.
 */
export class CompleteSingleSignOnUseCase {
    #samlGateway;
    #sessionStore;

    /** @param {{ samlGateway: SamlGatewayPort, sessionStore: SessionStorePort }} dependencies */
    constructor(dependencies) {
        this.#samlGateway = dependencies.samlGateway;
        this.#sessionStore = dependencies.sessionStore;
    }

    /**
     * @param {{ samlResponse: string, relayState: string }} command
     * @returns {Promise<{ sessionId: string, returnTo: string }>}
     */
    async execute(command) {
        const authenticatedUser = await this.#samlGateway.validateSamlResponse(command.samlResponse);

        return {
            sessionId: this.#sessionStore.create(authenticatedUser),
            returnTo: toSafeLandingPage(command.relayState),
        };
    }
}

/*
 * RelayState arrives from outside and becomes a redirect target verbatim.
 * Only local paths are accepted; otherwise the IdP — or an attacker — could send a
 * freshly signed-in user to any site at all.
 */
function toSafeLandingPage(relayState) {
    const isLocalPath = relayState.startsWith("/") && !relayState.startsWith("//");

    return isLocalPath ? relayState : DEFAULT_LANDING_PAGE;
}
