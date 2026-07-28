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

```text
domain          user-directory / service-provider-registry / saml-response.factory
                authenticated-user
application     issue-saml-response / start-single-sign-on / complete-single-sign-on
adapters        idp.controller / sp.controller / idp.presenter / sp.presenter
                authn-request.parser / idp-metadata.factory
infrastructure  xml-crypto-assertion-signer / node-saml.gateway
                idp-metadata.client / in-memory-session-store / express / ejs / cookie
```

### 视图

HTML 不写在 JavaScript 里。职责切成三层：

```text
presenter        决定用哪个模板、模板需要哪些数据，返回 { view, model }
views/*.ejs      纯 HTML 模板，转义由 EJS 的 <%= %> 负责
shared/public/   静态样式表，IdP 与 SP 各自挂到自己的根路径下
```

controller 通过 `shared/render-view.js` 调用模板引擎，因此 controller 与 presenter
都不认识 EJS。换模板引擎时只需要改 `render-view.js` 和两个 feature 的组装点。

Port 用 JSDoc `@typedef` 声明在使用它的 use case 文件顶部。JavaScript 没有
interface 关键字，为一个只有一两个方法的 port 单独建文件只会增加跳转成本。

## 8. Dependencies

```text
controller → use case → domain
controller → presenter
use case   → port（AssertionSignerPort / ClockPort / SamlGatewayPort / SessionStorePort）
adapter    → port 实现
```

domain 与 application 层不 import `express`、`xml-crypto`、`@node-saml/node-saml`。

## 9. External Details

- `express` / `cookie-parser`：HTTP 传输。
- `xml-crypto`：XML 规范化、摘要、RSA 签名与验签。
- `@node-saml/node-saml`：AuthnRequest 生成、SAMLResponse 协议校验、SP metadata。
- `selfsigned`：Demo 启动时临时生成 IdP 的自签名 X.509 证书。
- 会话存储：进程内 Map。

## 10. Test Strategy

- domain：`saml-response.factory` 给定固定时间应产出预期的时间窗与 Audience；
  用户目录和 SP 注册表对未知条目抛出领域错误。
- use case：用假 `AssertionSignerPort` / `ClockPort` / `SamlGatewayPort` 验证流程，
  不需要 HTTP 与密钥。
- adapter：`authn-request.parser` 对合法与损坏的 SAMLRequest 的行为。
- 集成：`npm run e2e` 用 `fetch` 走完整流程（含篡改场景），断言正常登录成功、
  篡改后被拒绝。

本仓库当前只落地了集成测试（`scripts/e2e.js`），domain 与 use case 的单元测试尚未编写。

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
