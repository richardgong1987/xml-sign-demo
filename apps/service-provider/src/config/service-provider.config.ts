import {randomBytes} from "node:crypto";

/*
 * The SP's own configuration. All it needs to know about the IdP is where to read its
 * metadata; the SSO endpoint and the signing certificate are imported from there.
 *
 * Next has no place to hang command-line flags, so this reads the environment instead —
 * the same values the Nest version took as --port and --idp-url.
 */

export interface ServiceProviderConfig {
    readonly baseUrl: string;
    readonly entityId: string;
    readonly assertionConsumerServiceUrl: string;
    readonly identityProviderMetadataUrl: string;
    readonly acceptedClockSkewMs: number;
    /** Also the entire lifetime of a sign-in: a JWT cannot be revoked before it expires. */
    readonly accessTokenLifetimeSeconds: number;
    readonly accessTokenSecret: Uint8Array;
}

/** Only the keys this configuration reads, so a test can pass a plain object. */
export type ServiceProviderEnv = Record<string, string | undefined>;

export const DEFAULT_SERVICE_PROVIDER_BASE_URL = "http://localhost:3000";
export const DEFAULT_IDENTITY_PROVIDER_BASE_URL = "http://localhost:4000";

export function readServiceProviderConfig(env: ServiceProviderEnv = process.env): ServiceProviderConfig {
    const baseUrl = env.SP_BASE_URL ?? DEFAULT_SERVICE_PROVIDER_BASE_URL;
    const identityProviderBaseUrl = env.IDP_BASE_URL ?? DEFAULT_IDENTITY_PROVIDER_BASE_URL;

    return Object.freeze({
        baseUrl,
        entityId: `${baseUrl}/api/saml/metadata`,
        assertionConsumerServiceUrl: `${baseUrl}/api/saml/acs`,

        // The SP hardcodes neither the IdP's SSO URL nor its certificate; both are
        // imported from this metadata document the first time SSO is used.
        identityProviderMetadataUrl: `${identityProviderBaseUrl}/idp/metadata`,

        acceptedClockSkewMs: 5_000,
        accessTokenLifetimeSeconds: 15 * 60,
        accessTokenSecret: readAccessTokenSecret(env),
    });
}

/*
 * Production must supply this: every instance has to sign with the same key, or a token
 * minted by one would be rejected by the next. The random fallback keeps the demo
 * runnable without a secret in the repository, at the cost of invalidating every token
 * on restart.
 */
function readAccessTokenSecret(env: ServiceProviderEnv): Uint8Array {
    const configured = env.SP_ACCESS_TOKEN_SECRET;

    if (configured) {
        return new TextEncoder().encode(configured);
    }

    return new Uint8Array(randomBytes(32));
}
