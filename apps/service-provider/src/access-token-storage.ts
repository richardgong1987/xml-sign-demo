/*
 * The one place the storage key is written down. The hand-off page, every page that
 * reads the token, and the sign-out button all import it from here.
 */
export const ACCESS_TOKEN_KEY = "sp_access_token";
