"use strict";

/*
 * Demo 专用：模拟浏览器或网络中间人在 POST 到 SP 之前修改已签名的 XML。
 *
 * 这段代码不属于 IdP 的业务逻辑，生产代码里不应该存在。
 * 它的作用是让 /api/saml/acs 有机会演示“签名校验失败”这条路径。
 */
const ROLE_ATTRIBUTE_VALUE = /(<saml:Attribute Name="role">\s*<saml:AttributeValue>)[^<]*/;

function tamperWithRole(signedSamlResponse) {
    return signedSamlResponse.replace(ROLE_ATTRIBUTE_VALUE, "$1administrator");
}

module.exports = { tamperWithRole };
