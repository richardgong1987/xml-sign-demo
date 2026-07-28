import {execFileSync} from "node:child_process";
import path from "node:path";

import {RunningApplications, startApplications} from "./run-applications";

declare global {
    // eslint-disable-next-line no-var
    var __SAML_DEMO_APPLICATIONS__: RunningApplications | undefined;
}

/**
 * Builds both applications and starts them. `next start` needs a production build, so
 * the first run of this suite is slow; later runs reuse `.next` unless sources changed.
 */
export default async function globalSetup(): Promise<void> {
    const repositoryRoot = path.join(__dirname, "..");

    execFileSync("npm", ["run", "build"], {cwd: repositoryRoot, stdio: "inherit"});

    globalThis.__SAML_DEMO_APPLICATIONS__ = await startApplications();
}
