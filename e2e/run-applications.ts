import {ChildProcess, spawn} from "node:child_process";
import path from "node:path";

import {
    ACCESS_TOKEN_SECRET,
    IDENTITY_PROVIDER_BASE_URL,
    IDENTITY_PROVIDER_PORT,
    SERVICE_PROVIDER_BASE_URL,
    SERVICE_PROVIDER_PORT,
} from "./ports";

const REPOSITORY_ROOT = path.join(__dirname, "..");
const READY_TIMEOUT_MS = 60_000;

export interface RunningApplications {
    identityProvider: ChildProcess;
    serviceProvider: ChildProcess;
}

/**
 * Production starts each application from its own workspace; this is the only place
 * anything runs both at once.
 *
 * The order is the trust-establishment order: the SP imports the IdP's signing
 * certificate the first time SSO is used, so the IdP has to be answering first.
 */
export async function startApplications(): Promise<RunningApplications> {
    const identityProvider = spawn(
        "node",
        [
            "apps/identity-provider/dist/main.js",
            "--port",
            String(IDENTITY_PROVIDER_PORT),
            "--sp-url",
            SERVICE_PROVIDER_BASE_URL,
        ],
        {cwd: REPOSITORY_ROOT, stdio: "inherit"},
    );

    await waitUntilAnswering(`${IDENTITY_PROVIDER_BASE_URL}/idp/metadata`, identityProvider);

    const serviceProvider = spawn(
        "npx",
        ["next", "start", "--port", String(SERVICE_PROVIDER_PORT)],
        {
            cwd: path.join(REPOSITORY_ROOT, "apps", "service-provider"),
            stdio: "inherit",
            env: {
                ...process.env,
                SP_BASE_URL: SERVICE_PROVIDER_BASE_URL,
                IDP_BASE_URL: IDENTITY_PROVIDER_BASE_URL,
                SP_ACCESS_TOKEN_SECRET: ACCESS_TOKEN_SECRET,
            },
        },
    );

    await waitUntilAnswering(`${SERVICE_PROVIDER_BASE_URL}/`, serviceProvider);

    return {identityProvider, serviceProvider};
}

export async function stopApplications(applications: RunningApplications): Promise<void> {
    await Promise.all([
        stop(applications.serviceProvider),
        stop(applications.identityProvider),
    ]);
}

function stop(child: ChildProcess): Promise<void> {
    if (child.exitCode !== null || child.signalCode !== null) {
        return Promise.resolve();
    }

    return new Promise((resolve) => {
        child.once("exit", () => resolve());
        child.kill("SIGTERM");
    });
}

async function waitUntilAnswering(url: string, child: ChildProcess): Promise<void> {
    const deadline = Date.now() + READY_TIMEOUT_MS;

    while (Date.now() < deadline) {
        if (child.exitCode !== null) {
            throw new Error(`${url} never came up: the process exited with ${child.exitCode}`);
        }

        try {
            await fetch(url, {signal: AbortSignal.timeout(1_000)});
            return;
        } catch {
            await new Promise((resolve) => setTimeout(resolve, 250));
        }
    }

    throw new Error(`${url} did not answer within ${READY_TIMEOUT_MS}ms`);
}
