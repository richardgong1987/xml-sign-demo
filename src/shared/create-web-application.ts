import {NestFactory} from "@nestjs/core";
import {NestExpressApplication} from "@nestjs/platform-express";

import {SamlFailureFilter} from "./saml-failure.filter";
import {configureWebLayer} from "./web-layer";

export interface WebApplicationOptions {
    readonly module: Parameters<typeof NestFactory.create>[0];
    /** The application's own views/ directory; shared/views is added as a fallback. */
    readonly viewsDir: string;
    /** Prefixes the log lines and the message the browser sees on a rejection. */
    readonly serviceName: string;
    readonly configure?: (app: NestExpressApplication) => void;
}

/**
 * The web plumbing both applications happen to want: EJS views, the shared stylesheet,
 * and the failure filter. Everything else each application decides for itself.
 */
export async function createWebApplication(
    options: WebApplicationOptions,
): Promise<NestExpressApplication> {
    const app = await NestFactory.create<NestExpressApplication>(options.module, {
        logger: ["error", "warn"],
    });

    configureWebLayer(app, options.viewsDir);
    app.useGlobalFilters(new SamlFailureFilter(options.serviceName));
    options.configure?.(app);

    return app;
}
