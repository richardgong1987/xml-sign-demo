"use strict";

/*
 * IdP 的用户目录。生产环境是 LDAP / OpenAM 的身份库，
 * 这里用常量表示，好让 Demo 不依赖任何外部系统。
 */

class UnknownUserError extends Error {
    constructor(uid) {
        super(`IdP 无法认证未知用户：${uid}`);
        this.name = "UnknownUserError";
    }
}

const USERS_BY_UID = Object.freeze({
    hanjin: Object.freeze({ uid: "hanjin", email: "hanjin@example.test", role: "trader" }),
    sakura: Object.freeze({ uid: "sakura", email: "sakura@example.test", role: "auditor" }),
});

function listUsers() {
    return Object.values(USERS_BY_UID);
}

function findUser(uid) {
    if (!Object.hasOwn(USERS_BY_UID, uid)) {
        throw new UnknownUserError(uid);
    }

    return USERS_BY_UID[uid];
}

module.exports = { listUsers, findUser, UnknownUserError };
