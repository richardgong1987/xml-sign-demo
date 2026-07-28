import crypto from "node:crypto";

/*
 * SAML IDs are xs:ID values, which may not start with a digit — hence the underscore prefix.
 */
export function createSamlId() {
    return `_${crypto.randomUUID()}`;
}
