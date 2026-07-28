"use strict";

const { escapeHtml } = require("../../shared/escape-html");

const PAGE_STYLE = `body{font-family:system-ui,sans-serif;max-width:44rem;margin:3rem auto;padding:0 1rem;line-height:1.7}
code{background:#f2f2f2;padding:.1rem .3rem;border-radius:3px}
table{border-collapse:collapse}td{border:1px solid #ddd;padding:.4rem .8rem}
a{color:#0b57d0}`;

function renderHomePage() {
    return `<!doctype html>
<meta charset="utf-8">
<title>JSL-online（SP）</title>
<style>${PAGE_STYLE}</style>

<h1>JSL-online（SP）</h1>
<p>当前未登录。</p>

<p><a href="/login">通过 Demo OpenAM 登录</a></p>

<h2>SP 对外暴露的 SAML 接口</h2>
<ul>
  <li><code>GET /api/saml/metadata</code>：SP metadata，交给 IdP 注册</li>
  <li><code>POST /api/saml/acs</code>：接收 IdP 投递的 SAMLResponse</li>
</ul>`;
}

function renderProfilePage(authenticatedUser) {
    const rows = Object.entries(authenticatedUser)
        .map(([field, value]) => `  <tr><td>${escapeHtml(field)}</td><td>${escapeHtml(value)}</td></tr>`)
        .join("\n");

    return `<!doctype html>
<meta charset="utf-8">
<title>已登录 - JSL-online</title>
<style>${PAGE_STYLE}</style>

<h1>登录成功</h1>
<p>以下内容来自 IdP 签名的 Assertion，已经通过签名和 SAML 协议校验。</p>

<table>
${rows}
</table>

<form method="post" action="/logout"><button type="submit">退出登录</button></form>`;
}

module.exports = { renderHomePage, renderProfilePage };
