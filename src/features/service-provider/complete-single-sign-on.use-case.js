"use strict";

/**
 * @typedef {import("./start-single-sign-on.use-case").SamlGatewayPort} SamlGatewayPort
 * @typedef {{ create: (user: object) => string, find: (sessionId: string) => object | null }} SessionStorePort
 */

const DEFAULT_LANDING_PAGE = "/profile";

/**
 * SP 校验 IdP 签发的 SAMLResponse，并为通过校验的用户建立本地会话。
 *
 * 这是整个流程的信任转换点：SAML 断言在这里换成 SP 自己的会话，
 * 之后的业务请求不再关心 SAML。
 */
class CompleteSingleSignOnUseCase {
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
 * RelayState 来自外部，会原样变成重定向目标。
 * 只接受站内路径，否则 IdP 或攻击者就能把登录后的用户送到任意站点。
 */
function toSafeLandingPage(relayState) {
    const isLocalPath = relayState.startsWith("/") && !relayState.startsWith("//");

    return isLocalPath ? relayState : DEFAULT_LANDING_PAGE;
}

module.exports = { CompleteSingleSignOnUseCase };
