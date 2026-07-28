"use strict";

/*
 * 边界处的错误翻译：把内部错误变成 HTTP 响应，并且不把堆栈泄露给浏览器。
 */
function createHttpErrorHandler(serviceName) {
    return function handleHttpError(error, request, response, next) {
        if (response.headersSent) {
            next(error);
            return;
        }

        console.error(`[${serviceName}] ${request.method} ${request.originalUrl} 失败：`, error.message);

        response.status(400).type("text/plain; charset=utf-8").send(`${serviceName} 处理失败：${error.message}`);
    };
}

module.exports = { createHttpErrorHandler };
