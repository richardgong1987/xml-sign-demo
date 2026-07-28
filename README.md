# SAML SSO Demo：IdP 与 SP 如何配合

这个仓库用两种方式演示同一件事：`@node-saml/node-saml` 与 `xml-crypto` 的分工。

| 方式 | 命令 | 说明 |
| --- | --- | --- |
| HTTP 版 | `npm start` | 两个 Express 服务，浏览器里走完整 SSO 流程 |
| 离线版 | `npm run demo` | 单进程直接方法调用，只看签名与验签 |
| 测试 | `npm test` | 单元测试 + 端到端测试 |

## 运行环境

- Node.js 18 或更高版本
- npm

## HTTP 版

```bash
npm install
npm start
```

然后打开 <http://localhost:5000>，点击「通过 Demo OpenAM 登录」。

进程里同时启动两个独立的服务：

- **Demo OpenAM（IdP）** `http://localhost:4000`
- **JSL-online（SP）** `http://localhost:5000`

### 接口

| 服务 | 接口 | 作用 |
| --- | --- | --- |
| IdP | `GET /idp/metadata` | 公布 Entity ID、SSO 地址和签名证书 |
| IdP | `GET /idp/sso` | 接收 AuthnRequest，显示登录页 |
| IdP | `POST /idp/login` | 用私钥签发 SAMLResponse，自动 POST 回 SP |
| SP | `GET /login` | 生成 AuthnRequest，跳转到 IdP |
| SP | `GET /api/saml/metadata` | SP metadata，交给 IdP 注册 |
| SP | `POST /api/saml/acs` | 校验 SAMLResponse，建立会话 |
| SP | `GET /profile` | 显示已登录用户 |

### 完整流程

```text
浏览器            SP (:5000)                      IdP (:4000)
  │  GET /login       │                                │
  │──────────────────>│ 生成 AuthnRequest              │
  │<── 302 ───────────│                                │
  │  GET /idp/sso?SAMLRequest=..&RelayState=..         │
  │───────────────────────────────────────────────────>│ 解析 AuthnRequest
  │<────────────────────────── 登录页面（选择演示用户）──│
  │  POST /idp/login  │                                │
  │───────────────────────────────────────────────────>│ xml-crypto 用私钥签 Assertion
  │<────────────────────────── 自动提交表单（SAMLResponse）
  │  POST /api/saml/acs                                │
  │──────────────────>│ node-saml → xml-crypto 验签    │
  │                   │ 验 Audience/Recipient/有效期    │
  │<── 302 /profile ──│ Set-Cookie                     │
```

信任关系：SP 启动时抓取 `GET /idp/metadata`，从中导入 IdP 的签名证书，
配置成 `node-saml` 的 `idpCert`。**SP 全程不接触 IdP 私钥。**

### 篡改测试

IdP 登录页上有一个「模拟中间人」勾选框。勾上之后，IdP 会在签名完成之后把
`role` 改成 `administrator`，再交给浏览器 POST 给 SP。SP 的 ACS 会返回
`Invalid signature`，会话不会建立。

## 测试

```bash
npm test           # 全部 38 个用例
npm run test:unit  # domain 与 use case，27 个，不需要 HTTP 和密钥
npm run test:e2e   # 端到端，11 个，真实启动两个服务
```

用 Node 内置的 `node:test`，没有额外依赖。

端到端测试复用 `src/bootstrap.js` 启动服务，用带 Cookie 的 `fetch` 扮演浏览器，
逐跳断言整条链路，并覆盖两条拒绝路径：中间人篡改（`Invalid signature`）和
重放同一份 SAMLResponse（`InResponseTo is not valid`）。它跑在 14000/15000 端口，
所以开着 `npm start` 也能执行。

## 离线版

```bash
npm run demo
```

不启动 HTTP 服务，也不发送请求，在一个进程里直接调用两个库的方法。适合先看清
「哪一层在做签名，哪一层在做协议校验」。阅读顺序见 `demo.js` 的 `main()`。

## 两个库的职责

### `xml-crypto`

底层 XML 数字签名：Canonicalization、Digest、RSA 签名与验签，
以及 `getSignedReferences()`——只有它返回的内容才是签名真正保护的 XML。

### `@node-saml/node-saml`

完整的 SAML 协议：生成 AuthnRequest、Base64 解码 SAMLResponse、内部调用
`xml-crypto` 验签，再校验 Audience、Recipient、InResponseTo、NotBefore /
NotOnOrAfter，最后返回用户 Profile。

一句话：**`xml-crypto` 证明这段 XML 没被改过；`node-saml` 证明这份登录结果
是发给我们的、现在有效、来自我们信任的 IdP。**

## 目录结构

```text
docs/design/saml-sso-http.md   设计文档：边界、依赖方向、测试策略
src/config.js                  由端口推导出两端的 Entity ID、地址、有效期
src/bootstrap.js               组装根：装配两个 app，先起 IdP 再让 SP 导入 metadata
src/server.js                  命令行入口，打印启动信息
src/models/                    业务规则：用户目录、SP 注册表、SAMLResponse 构造
src/services/                  用例与外部依赖：签名、node-saml、会话、metadata 抓取
src/controllers/               HTTP 边界：idp.controller、sp.controller
src/presenters/                决定用哪个模板、模板需要什么数据
src/views/                     EJS 模板，含公共 layout _head.ejs / _foot.ejs
src/public/demo.css            两个服务共用的样式表
src/utils/                     时钟、SAML ID、证书、模板引擎等通用工具
tests/models/  tests/services/ 单元测试
tests/e2e/                     端到端测试
demo.js                        离线版
```

一份文件属于哪一层，看它「因为什么原因才需要改」：

| 目录 | 改动原因 |
| --- | --- |
| `models/` | 业务规则变了 |
| `services/` | 流程变了，或换了外部库、存储 |
| `controllers/` | 接口协议变了 |
| `presenters/` `views/` | 页面展示变了 |
| `utils/` | 通用技术细节变了 |

HTML 全部在 `src/views/*.ejs` 里，presenter 只负责挑模板和准备数据（`{ view, model }`），
controller 通过 `utils/render-view.js` 渲染，因此业务代码里没有 HTML 字符串。
每个页面以 `include("_head", { title })` 开头、`include("_foot")` 结尾，
IdP 与 SP 共用同一份模板目录和样式表。

## 生产环境的差异

- IdP 私钥由企业 PKI 签发并长期保存；本 Demo 每次启动临时生成。
- AuthnRequest 上下文应放在 IdP 会话里；本 Demo 用隐藏表单字段。
- 会话应放在 Redis 或数据库；本 Demo 用进程内 Map。
- `tampering.simulator.js` 是演示用的攻击模拟，生产代码中不应存在。
