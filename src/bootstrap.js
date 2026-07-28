import { createSamlConfigs } from "./config.js";
import { createDemoSigningCredential } from "./shared/utils/demo-signing-credential.js";
import { createIdentityProviderApp } from "./identity-provider/app.js";
import { createServiceProviderApp } from "./service-provider/app.js";
import { fetchIdentityProviderMetadata } from "./service-provider/services/idp-metadata.client.js";

/**
 * 组装根：启动 IdP 与 SP 两个项目。
 *
 * 顺序本身就是 SAML 的信任建立顺序：
 *   IdP 先持有私钥并公布 metadata，SP 才能从 metadata 里导入证书。
 *
 * 端到端测试复用这个函数，测的就是真实的装配结果。
 *
 * @param {{ identityProviderPort: number, serviceProviderPort: number }} ports
 */
export async function startSamlDemo(ports) {
    const { identityProviderConfig, serviceProviderConfig } = createSamlConfigs(ports);

    const signingCredential = await createDemoSigningCredential("Demo OpenAM Signing");

    const identityProviderServer = await listen(
        createIdentityProviderApp({ config: identityProviderConfig, signingCredential }),
        identityProviderConfig.port,
    );

    const identityProvider = await fetchIdentityProviderMetadata(
        serviceProviderConfig.identityProviderMetadataUrl,
    );

    const serviceProviderServer = await listen(
        createServiceProviderApp({ config: serviceProviderConfig, identityProvider }),
        serviceProviderConfig.port,
    );

    return {
        identityProviderConfig,
        serviceProviderConfig,
        identityProvider,
        async stop() {
            await Promise.all([close(serviceProviderServer), close(identityProviderServer)]);
        },
    };
}

function listen(app, port) {
    return new Promise((resolve, reject) => {
        const server = app.listen(port, () => resolve(server));
        server.on("error", reject);
    });
}

function close(server) {
    return new Promise((resolve) => server.close(resolve));
}

