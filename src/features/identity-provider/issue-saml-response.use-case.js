"use strict";

const { findUser } = require("./user-directory");
const { createUnsignedSamlResponse } = require("./saml-response.factory");

/**
 * @typedef {{ signAssertion: (samlResponseXml: string) => string }} AssertionSignerPort
 * @typedef {{ now: () => Date }} ClockPort
 *
 * @typedef {{
 *   uid: string,
 *   serviceProviderEntityId: string,
 *   authnRequestId: string,
 * }} IssueSamlResponseCommand
 */

/**
 * 用户在 IdP 完成认证后，IdP 为指定的 SP 签发一份已签名的 SAMLResponse。
 */
class IssueSamlResponseUseCase {
    #identityProvider;
    #serviceProviderRegistry;
    #assertionSigner;
    #clock;

    /**
     * @param {{
     *   identityProvider: { entityId: string, assertionLifetimeMs: number, acceptedClockSkewMs: number },
     *   serviceProviderRegistry: { find: (entityId: string) => object },
     *   assertionSigner: AssertionSignerPort,
     *   clock: ClockPort,
     * }} dependencies
     */
    constructor(dependencies) {
        this.#identityProvider = dependencies.identityProvider;
        this.#serviceProviderRegistry = dependencies.serviceProviderRegistry;
        this.#assertionSigner = dependencies.assertionSigner;
        this.#clock = dependencies.clock;
    }

    /**
     * @param {IssueSamlResponseCommand} command
     * @returns {{ assertionConsumerServiceUrl: string, samlResponse: string }}
     */
    execute(command) {
        const user = findUser(command.uid);
        const serviceProvider = this.#serviceProviderRegistry.find(command.serviceProviderEntityId);

        const unsignedSamlResponse = createUnsignedSamlResponse({
            identityProviderEntityId: this.#identityProvider.entityId,
            serviceProvider,
            user,
            authnRequestId: command.authnRequestId,
            issuedAt: this.#clock.now(),
            assertionLifetimeMs: this.#identityProvider.assertionLifetimeMs,
            acceptedClockSkewMs: this.#identityProvider.acceptedClockSkewMs,
        });

        return {
            assertionConsumerServiceUrl: serviceProvider.assertionConsumerServiceUrl,
            samlResponse: this.#assertionSigner.signAssertion(unsignedSamlResponse),
        };
    }
}

module.exports = { IssueSamlResponseUseCase };
