import {stopApplications} from "./run-applications";

export default async function globalTeardown(): Promise<void> {
    const applications = globalThis.__SAML_DEMO_APPLICATIONS__;

    if (applications) {
        await stopApplications(applications);
    }
}
