"use strict";

const path = require("node:path");

/*
 * IdP 与 SP 是两个独立的服务，但共用同一份样式表。
 * 两边都把这个目录挂到自己的根路径下，于是各自的 /demo.css 都能取到。
 */
const STATIC_ASSETS_DIR = path.join(__dirname, "public");

module.exports = { STATIC_ASSETS_DIR };
