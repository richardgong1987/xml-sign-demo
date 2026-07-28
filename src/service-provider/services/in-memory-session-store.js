import crypto from "node:crypto";

/**
 * SessionStorePort 的实现。
 *
 * 进程内 Map：重启即丢失，也不能多实例部署。生产环境换成 Redis 或数据库时，
 * use case 不需要修改。
 */
export function createInMemorySessionStore() {
    const usersBySessionId = new Map();

    return Object.freeze({
        create(authenticatedUser) {
            const sessionId = crypto.randomUUID();
            usersBySessionId.set(sessionId, authenticatedUser);

            return sessionId;
        },

        // 查不到会话是正常状态（未登录、已过期），不是异常。
        find(sessionId) {
            return usersBySessionId.get(sessionId) ?? null;
        },

        remove(sessionId) {
            usersBySessionId.delete(sessionId);
        },
    });
}

