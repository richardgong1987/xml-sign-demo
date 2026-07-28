/*
 * Deliberately not the 4000/3000 pair the two applications default to, so the suite can
 * run while a development server is up.
 */
export const IDENTITY_PROVIDER_PORT = 14000;
export const SERVICE_PROVIDER_PORT = 15000;

export const IDENTITY_PROVIDER_BASE_URL = `http://localhost:${IDENTITY_PROVIDER_PORT}`;
export const SERVICE_PROVIDER_BASE_URL = `http://localhost:${SERVICE_PROVIDER_PORT}`;

/** Fixed so a token minted in one spec is still verifiable in the next. */
export const ACCESS_TOKEN_SECRET = "e2e-access-token-secret-e2e-access-token-secret";
