import crypto from "node:crypto";

/*
 * SAML 的 ID 是 xs:ID 类型，不能以数字开头，所以加下划线前缀。
 */
export function createSamlId() {
    return `_${crypto.randomUUID()}`;
}

