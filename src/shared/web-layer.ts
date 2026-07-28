import path from "node:path";
import { NestExpressApplication } from "@nestjs/platform-express";

const SHARED_VIEWS_DIR = path.join(__dirname, "views");
const PUBLIC_DIR = path.join(__dirname, "public");

/**
 * Gives an application its view directories and the shared stylesheet.
 *
 * Templates resolve against the project's own views/ first and fall back to
 * shared/views for the common layout (_head / _foot).
 */
export function configureWebLayer(app: NestExpressApplication, ownViewsDir: string): void {
    const viewDirectories = [ownViewsDir, SHARED_VIEWS_DIR];

    app.setBaseViewsDir(viewDirectories);
    app.setViewEngine("ejs");
    app.useStaticAssets(PUBLIC_DIR);

    /*
     * Express uses its views setting for res.render only and never forwards it to the
     * template engine, while EJS resolves include() from options.views. Mirroring the
     * list into app.locals is what lets a template simply write include("_head").
     */
    app.getHttpAdapter().getInstance().locals.views = viewDirectories;
}
