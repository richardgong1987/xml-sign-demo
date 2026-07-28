# SAML SSO over HTTP Design

## 1. Business Purpose

原来的 `demo.js` 在一个进程里用直接方法调用演示签名与验签。它能说明 `xml-crypto` 和
`@node-saml/node-saml` 的分工，但看不到 IdP 与 SP 之间真正的协作过程：谁先发起、
浏览器怎么中转、信任关系从哪里来。

本设计把同一份业务知识放到两个独立的 HTTP 服务里，让工程师可以在浏览器中看到
完整的 SP-initiated Single Sign-On 流程。

## 2. Use Case

- IdP：`用户在 IdP 完成认证后，IdP 为指定的 SP 签发一份已签名的 SAMLResponse。`
- SP：`SP 校验 IdP 签发的 SAMLResponse，并为通过校验的用户建立本地会话。`

## 3. Input Model

| 用例 | 输入 |
| --- | --- |
| `IssueSamlResponseUseCase` | `{ uid, serviceProviderEntityId, authnRequestId }` |
| `StartSingleSignOnUseCase` | `{ returnTo }` |
| `CompleteSingleSignOnUseCase` | `{ samlResponse, relayState }` |

外部输入（`req.query`、`req.body`、Base64、Deflate）在 adapter 层翻译成上述模型，
不会直接进入 use case。

## 4. Output Model

| 用例 | 输出 |
| --- | --- |
| `IssueSamlResponseUseCase` | `{ assertionConsumerServiceUrl, samlResponse }` |
| `StartSingleSignOnUseCase` | IdP 登录地址（字符串） |
| `CompleteSingleSignOnUseCase` | `{ sessionId, returnTo }` |

## 5. Domain Rules

IdP 侧：

- 只能为已注册的 SP 签发 Assertion；ACS 地址取自 IdP 自己的注册表，不取自请求参数。
- Assertion 的 Audience 必须是目标 SP 的 Entity ID。
- Assertion 有明确有效期，并允许约定的时钟偏差。
- Assertion 必须携带 `InResponseTo`，与 SP 发出的 AuthnRequest 对应。

SP 侧：

- 只接受由已配置的 IdP 证书签名的 Assertion。
- RelayState 只能是本站内部路径，否则回落到默认页面（防开放重定向）。
- 只有校验通过的用户才能建立会话。

## 6. Application Flow

```text
浏览器            SP (:5000)                      IdP (:4000)
  │  GET /login       │                                │
  │──────────────────>│ StartSingleSignOnUseCase       │
  │<── 302 ───────────│ 生成 AuthnRequest（Deflate+Base64）
  │  GET /idp/sso?SAMLRequest=..&RelayState=..         │
  │───────────────────────────────────────────────────>│ 解析 AuthnRequest
  │<────────────────────────── 登录页面（选择演示用户）──│
  │  POST /idp/login  │                                │
  │───────────────────────────────────────────────────>│ IssueSamlResponseUseCase
  │                   │                                │   ├─ 查注册表拿 ACS
  │                   │                                │   ├─ 构造 SAMLResponse
  │                   │                                │   └─ xml-crypto 用私钥签 Assertion
  │<────────────────────────── 自动提交表单（SAMLResponse）
  │  POST /api/saml/acs                                │
  │──────────────────>│ CompleteSingleSignOnUseCase    │
  │                   │   ├─ node-saml → xml-crypto 验签
  │                   │   ├─ 验 Audience/Recipient/有效期/InResponseTo
  │                   │   └─ 建立会话，Set-Cookie
  │<── 302 /profile ──│                                │
```

信任的建立：SP 启动时抓取 `GET /idp/metadata`，从中取出 IdP 的 Entity ID、
SSO 地址和签名证书，作为 `node-saml` 的 `idpCert`。SP 全程不接触 IdP 私钥。

## 7. Architecture Boundary

第一层边界是「两个独立项目」，第二层才是技术分层。
IdP 与 SP 各自成目录，只通过 HTTP 打交道，不 import 对方的任何文件。

```text
src/identity-provider/          src/service-provider/
├── models/                     ├── models/
│   user-directory              │   authenticated-user
│   service-provider-registry   │
│   saml-response.factory       │
│   idp-metadata.factory        │
├── services/                   ├── services/
│   issue-saml-response（用例）  │   start-single-sign-on（用例）
│   xml-crypto-assertion-signer │   complete-single-sign-on（用例）
│   authn-request.parser        │   node-saml.gateway
│   tampering.simulator         │   in-memory-session-store
│                               │   idp-metadata.client
├── controllers/                ├── controllers/
├── presenters/                 ├── presenters/
├── views/                      ├── views/
└── app.js（装配点）            └── app.js（装配点）

src/shared/utils/   时钟、SAML ID、X.509、模板引擎、错误处理
src/shared/views/   公共 layout
src/bootstrap.js    启动两个项目，并完成信任导入
```

在项目内部，一份文件放哪一层取决于它「因为什么原因才需要改」：
业务规则 → `models/`，流程或外部库 → `services/`，接口协议 → `controllers/`，
页面展示 → `presenters/` 与 `views/`，换实现 → `app.js`。

### 视图

HTML 不写在 JavaScript 里。职责切成三层：

```text
<项目>/presenters/   决定用哪个模板、模板需要哪些数据，返回 { view, model }
<项目>/views/        该项目的页面模板，转义由 EJS 的 <%= %> 负责
shared/views/       公共 layout：_head.ejs 与 _foot.ejs
shared/public/      静态样式表，两个项目各自挂到自己的根路径下
```

controller 通过 `shared/utils/render-view.js` 调用模板引擎，因此 controller 与 presenter
都不认识 EJS。换模板引擎时只需要改 `render-view.js`、`view-engine.js` 和模板本身。

`shared/utils/view-engine.js` 把每个 app 的模板目录设成
`[项目自己的 views, shared/views]`：页面在本项目里找，`include("_head")` 回落到
公共 layout。需要注意 Express 不会把 views 目录传给模板引擎，所以同一份目录列表
还要写进 `app.locals.views`，EJS 解析 include 时才看得到。

Port 用 JSDoc `@typedef` 声明在使用它的 use case 文件顶部。JavaScript 没有
interface 关键字，为一个只有一两个方法的 port 单独建文件只会增加跳转成本。

## 8. Dependencies

```text
controller → use case → domain
controller → presenter
use case   → port（AssertionSignerPort / ClockPort / SamlGatewayPort / SessionStorePort）
adapter    → port 实现
```

`models/` 与 `services/` 里的用例文件不 import `express`、`xml-crypto`、
`@node-saml/node-saml`。这几个库只出现在 `services/` 的适配文件、`controllers/`
和 `bootstrap.js` 里。

## 9. External Details

- `express` / `cookie-parser`：HTTP 传输。
- `xml-crypto`：XML 规范化、摘要、RSA 签名与验签。
- `@node-saml/node-saml`：AuthnRequest 生成、SAMLResponse 协议校验、SP metadata。
- `selfsigned`：Demo 启动时临时生成 IdP 的自签名 X.509 证书。
- 会话存储：进程内 Map。
- 运行时：Node.js ≥ 20.11，ES Module（`"type": "module"`），
  路径解析用 `import.meta.dirname`。

## 10. Test Strategy

`npm test` 一次跑完下面两层，共 38 个用例。

`tests/identity-provider/` 与 `tests/service-provider/`（27 个）不需要 HTTP、密钥或数据库：

- `saml-response.factory`：固定 `issuedAt` 下的时间窗、Audience、Destination、
  `InResponseTo` 回填、属性映射。
- `user-directory` / `service-provider-registry`：未知条目抛领域错误；
  `Object.hasOwn` 守卫挡住原型上的属性。
- `authenticated-user`：缺少 NameID 时拒绝创建，创建后不可修改。
- `IssueSamlResponseUseCase`：用假 `AssertionSignerPort` 与固定 `ClockPort`，
  断言投递地址取自注册表、时间来自注入的时钟、非法输入不会走到签名步骤。
- `CompleteSingleSignOnUseCase`：用假 `SamlGatewayPort` 与假 `SessionStorePort`，
  断言 RelayState 的站外回落规则，以及校验失败时不建立会话。

端到端（`tests/e2e/`，11 个）复用 `src/bootstrap.js` 真实启动两个服务，
用带 Cookie 的 `fetch` 扮演浏览器，逐跳断言：metadata 交换、AuthnRequest 生成与解析、
签发与投递、会话建立、RelayState 跳转、退出登录，以及两条拒绝路径
（中间人篡改 → `Invalid signature`；重放 → `InResponseTo is not valid`）。

端到端测试跑在 14000/15000 端口，因此开着 `npm start` 也能执行。

`identity-provider/services/authn-request.parser` 目前只被端到端流程间接覆盖，
针对损坏 SAMLRequest 的单元测试尚未编写。

## 11. Risks and Trade-offs

- IdP 用隐藏表单字段在 `/idp/sso` 与 `/idp/login` 之间传递 AuthnRequest 上下文。
  生产环境应放进 IdP 自己的会话，避免用户改写。
- IdP 私钥与证书每次启动重新生成，因此重启后旧的 Assertion 全部失效。生产环境由
  PKI 签发并长期保存。
- 会话存储在内存里，重启即丢失，也无法多实例部署。
- `tampering.simulator.js` 是演示用的攻击模拟，代表浏览器与网络中间人，
  不属于 IdP 的业务逻辑，生产代码中不应存在。
- SAML ID 由 `crypto.randomUUID()` 在 domain 内生成。时间通过 `ClockPort` 注入以
  保证可测试，但随机 ID 不影响断言，因此没有为它再引入一个 port。
