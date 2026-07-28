export class InvalidAuthenticatedUserError extends Error {
    constructor(reason) {
        super(`SAML 断言无法转换成登录用户：${reason}`);
        this.name = "InvalidAuthenticatedUserError";
    }
}

/**
 * SP 认可的登录用户。
 *
 * 到达这里的数据已经通过签名与 SAML 协议校验，所以它是 SP 会话的可信起点。
 * SP 自己的业务权限仍然由 SP 决定，IdP 给的 role 只是输入。
 *
 * @param {{ nameId: string, uid: string, email: string, role: string, sessionIndex: string }} params
 */
export function createAuthenticatedUser(params) {
    if (!params.nameId) {
        throw new InvalidAuthenticatedUserError("缺少 NameID");
    }

    return Object.freeze({ ...params });
}

