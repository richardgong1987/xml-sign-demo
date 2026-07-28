import { createSamlConfigs } from "./config.js";
import { createDemoSigningCredential } from "./shared/utils/demo-signing-credential.js";
import { createIdentityProviderApp } from "./identity-provider/app.js";
import { createServiceProviderApp } from "./service-provider/app.js";
import { fetchIdentityProviderMetadata } from "./service-provider/services/idp-metadata.client.js";

/**
 * Composition root: starts both projects.
 *
 * The order is the trust-establishment order itself: the IdP must hold its private
 * key and publish its metadata before the SP can import the certificate from it.
 *
 * The end-to-end suite reuses this function, so it exercises the real wiring.
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
