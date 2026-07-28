import path from "node:path";
import express from "express";

const SHARED_VIEWS_DIR = path.join(import.meta.dirname, "..", "views");
const PUBLIC_DIR = path.join(import.meta.dirname, "..", "public");

/**
 * Wires EJS into an Express app: templates resolve against the project's own
 * views/ first, then fall back to shared/views for the common layout
 * (_head / _foot). Also serves the shared stylesheet from shared/public.
 *
 * @param {import("express").Application} app
 * @param {string} ownViewsDir
 */
export function useEjsViews(app, ownViewsDir) {
    const viewDirectories = [ownViewsDir, SHARED_VIEWS_DIR];

    app.set("view engine", "ejs");
    app.set("views", viewDirectories);

    /*
     * Express uses its views setting for res.render only and never forwards it to
     * the template engine, while EJS resolves include() from options.views.
     * app.locals is merged into the render options, which is what lets a template
     * simply write include("_head").
     */
    app.locals.views = viewDirectories;

    app.use(express.static(PUBLIC_DIR));
}
