"use strict";

const crypto = require("node:crypto");

/*
 * SAML 的 ID 是 xs:ID 类型，不能以数字开头，所以加下划线前缀。
 */
function createSamlId() {
    return `_${crypto.randomUUID()}`;
}

module.exports = { createSamlId };
