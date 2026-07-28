"use strict";

const path = require("node:path");
const express = require("express");

const VIEWS_DIR = path.join(__dirname, "..", "views");
const PUBLIC_DIR = path.join(__dirname, "..", "public");

/**
 * 让一个 Express app 渲染 views/ 下的 EJS 模板，并对外提供 public/ 里的静态资源。
 *
 * IdP 与 SP 共用同一个模板目录，_head.ejs 与页面模板同级，
 * 所以 include("_head") 按相对路径就能解析，不需要额外配置查找目录。
 *
 * @param {import("express").Application} app
 */
function useEjsViews(app) {
    app.set("view engine", "ejs");
    app.set("views", VIEWS_DIR);

    app.use(express.static(PUBLIC_DIR));
}

module.exports = { useEjsViews };
