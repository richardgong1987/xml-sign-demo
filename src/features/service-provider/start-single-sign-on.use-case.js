"use strict";

/**
 * @typedef {{
 *   createLoginRedirectUrl: (relayState: string) => Promise<string>,
 *   validateSamlResponse: (samlResponseBase64: string) => Promise<object>,
 *   describeMetadata: () => string,
 * }} SamlGatewayPort
 */

/**
 * SP 发起 Single Sign-On：生成 AuthnRequest，并把用户送到 IdP。
 *
 * 用户登录后想回到的页面放在 RelayState 里。RelayState 对 IdP 是不透明的，
 * IdP 只负责原样带回来。
 */
class StartSingleSignOnUseCase {
    #samlGateway;

    /** @param {{ samlGateway: SamlGatewayPort }} dependencies */
    constructor(dependencies) {
        this.#samlGateway = dependencies.samlGateway;
    }

    /**
     * @param {{ returnTo: string }} command
     * @returns {Promise<string>} IdP 的登录地址
     */
    async execute(command) {
        return this.#samlGateway.createLoginRedirectUrl(command.returnTo);
    }
}

module.exports = { StartSingleSignOnUseCase };
