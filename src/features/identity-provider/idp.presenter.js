"use strict";

/*
 * Presenter 只回答两件事：用哪个模板，模板需要哪些数据。
 * HTML 在 views/ 下的 EJS 模板里，转义由 EJS 的 <%= %> 负责。
 */

/**
 * IdP 的登录页。
 *
 * AuthnRequest 的上下文用隐藏字段带到下一步。生产环境应该放进 IdP 自己的会话，
 * 避免用户改写；这里为了让流程一眼看得见而显式暴露。
 */
function toLoginPageView({ authnRequest, relayState, users }) {
    return {
        view: "login",
        model: {
            authnRequestId: authnRequest.requestId,
            serviceProviderEntityId: authnRequest.serviceProviderEntityId,
            relayState,
            users,
        },
    };
}

/**
 * HTTP-POST 绑定：IdP 无法直接调用 SP，只能返回一个自动提交的表单，
 * 由浏览器把 SAMLResponse POST 到 SP 的 ACS。
 */
function toAutoPostFormView({ assertionConsumerServiceUrl, samlResponse, relayState }) {
    return {
        view: "auto-post",
        model: {
            assertionConsumerServiceUrl,
            // HTTP-POST 绑定要求 SAMLResponse 以 Base64 传输。
            samlResponseBase64: Buffer.from(samlResponse, "utf8").toString("base64"),
            relayState,
        },
    };
}

module.exports = { toLoginPageView, toAutoPostFormView };
