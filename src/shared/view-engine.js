"use strict";

const path = require("node:path");

const SHARED_VIEWS_DIR = path.join(__dirname, "views");

/**
 * 让一个 Express app 用 EJS 渲染：优先找 feature 自己的模板，
 * 找不到再回落到 shared/views 里的公共 layout（_head / _foot）。
 *
 * @param {import("express").Application} app
 * @param {string} featureViewsDir
 */
function useEjsViews(app, featureViewsDir) {
    const viewDirectories = [featureViewsDir, SHARED_VIEWS_DIR];

    app.set("view engine", "ejs");
    app.set("views", viewDirectories);

    /*
     * Express 只把 views 目录用于 res.render，不会传给模板引擎，
     * 而 EJS 解析 include 时读的是 options.views。
     * app.locals 会被合并进渲染参数，于是模板里可以直接写 include("_head")。
     */
    app.locals.views = viewDirectories;
}

module.exports = { useEjsViews };
