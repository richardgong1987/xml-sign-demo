"use strict";

const { escapeHtml } = require("../../shared/escape-html");

const PAGE_STYLE = `body{font-family:system-ui,sans-serif;max-width:44rem;margin:3rem auto;padding:0 1rem;line-height:1.7}
code{background:#f2f2f2;padding:.1rem .3rem;border-radius:3px}
button{font-size:1rem;padding:.5rem 1rem;cursor:pointer}
ul{padding-left:1.2rem}`;

/**
 * IdP 的登录页。
 *
 * AuthnRequest 的上下文用隐藏字段带到下一步。生产环境应该放进 IdP 自己的会话，
 * 避免用户改写；这里为了让流程一眼看得见而显式暴露。
 */
function renderLoginPage({ authnRequest, relayState, users }) {
    const userOptions = users
        .map(
            (user) => `      <li>
        <button type="submit" name="uid" value="${escapeHtml(user.uid)}">
          以 ${escapeHtml(user.uid)} 登录（role=${escapeHtml(user.role)}）
        </button>
      </li>`,
        )
        .join("\n");

    return `<!doctype html>
<meta charset="utf-8">
<title>Demo OpenAM 登录</title>
<style>${PAGE_STYLE}</style>

<h1>Demo OpenAM（IdP）</h1>

<p>已收到来自 SP 的 AuthnRequest：</p>
<ul>
  <li>SP Entity ID：<code>${escapeHtml(authnRequest.serviceProviderEntityId)}</code></li>
  <li>Request ID：<code>${escapeHtml(authnRequest.requestId)}</code></li>
  <li>RelayState：<code>${escapeHtml(relayState || "（空）")}</code></li>
</ul>

<form method="post" action="/idp/login">
  <input type="hidden" name="authnRequestId" value="${escapeHtml(authnRequest.requestId)}">
  <input type="hidden" name="serviceProviderEntityId" value="${escapeHtml(authnRequest.serviceProviderEntityId)}">
  <input type="hidden" name="relayState" value="${escapeHtml(relayState)}">

  <h2>选择演示用户</h2>
  <ul>
${userOptions}
  </ul>

  <label>
    <input type="checkbox" name="tamper" value="on">
    模拟中间人：签名之后把 role 改成 administrator
  </label>
</form>`;
}

/**
 * HTTP-POST 绑定：IdP 无法直接调用 SP，只能返回一个自动提交的表单，
 * 由浏览器把 SAMLResponse POST 到 SP 的 ACS。
 */
function renderAutoPostForm({ assertionConsumerServiceUrl, samlResponse, relayState }) {
    const samlResponseBase64 = Buffer.from(samlResponse, "utf8").toString("base64");

    return `<!doctype html>
<meta charset="utf-8">
<title>正在跳转回 SP</title>
<style>${PAGE_STYLE}</style>

<h1>IdP 已签发 SAMLResponse</h1>
<p>浏览器正在把它 POST 到 <code>${escapeHtml(assertionConsumerServiceUrl)}</code></p>

<form id="saml-post-form" method="post" action="${escapeHtml(assertionConsumerServiceUrl)}">
  <input type="hidden" name="SAMLResponse" value="${escapeHtml(samlResponseBase64)}">
  <input type="hidden" name="RelayState" value="${escapeHtml(relayState)}">
  <noscript><button type="submit">继续</button></noscript>
</form>

<script>document.getElementById("saml-post-form").submit();</script>`;
}

module.exports = { renderLoginPage, renderAutoPostForm };
