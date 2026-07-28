"use strict";

/**
 * Presenter 返回 { view, model }，由这里交给模板引擎。
 *
 * 有了这一层，controller 不需要认识 EJS：换成别的模板引擎时，
 * 只有这个文件和各 feature 的组装点需要改。
 */
function renderView(response, { view, model }) {
    response.render(view, model);
}

module.exports = { renderView };
