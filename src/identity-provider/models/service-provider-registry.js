export class UnregisteredServiceProviderError extends Error {
    constructor(entityId) {
        super(`IdP 未注册这个 SP：${entityId}`);
        this.name = "UnregisteredServiceProviderError";
    }
}

/**
 * IdP 认可的 SP 列表。
 *
 * 这是一条安全规则，不只是配置查表：Assertion 的 Audience 和投递地址
 * 都由这份注册表决定。如果改成信任 AuthnRequest 里带来的 ACS 地址，
 * 攻击者就能让 IdP 把合法的 Assertion 投递到自己的服务器。
 */
export function createServiceProviderRegistry(serviceProviders) {
    const byEntityId = new Map(
        serviceProviders.map((serviceProvider) => [serviceProvider.entityId, serviceProvider]),
    );

    return Object.freeze({
        find(entityId) {
            const serviceProvider = byEntityId.get(entityId);

            if (!serviceProvider) {
                throw new UnregisteredServiceProviderError(entityId);
            }

            return serviceProvider;
        },
    });
}

