import path from "node:path";
import express from "express";

const SHARED_VIEWS_DIR = path.join(import.meta.dirname, "..", "views");
const PUBLIC_DIR = path.join(import.meta.dirname, "..", "public");

/**
 * 让一个 Express app 用 EJS 渲染：先找该项目自己的 views/，
 * 找不到再回落到 shared/views 里的公共 layout（_head / _foot）。
 * 同时对外提供 shared/public 里的静态资源。
 *
 * @param {import("express").Application} app
 * @param {string} ownViewsDir
 */
export function useEjsViews(app, ownViewsDir) {
    const viewDirectories = [ownViewsDir, SHARED_VIEWS_DIR];

    app.set("view engine", "ejs");
    app.set("views", viewDirectories);

    /*
     * Express 只把 views 目录用于 res.render，不会传给模板引擎，
     * 而 EJS 解析 include 时读的是 options.views。
     * app.locals 会被合并进渲染参数，于是模板里可以直接写 include("_head")。
     */
    app.locals.views = viewDirectories;

    app.use(express.static(PUBLIC_DIR));
}

