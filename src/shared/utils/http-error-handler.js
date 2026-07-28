import { styleText } from "node:util";

/*
 * 边界处的错误翻译：把内部错误变成 HTTP 响应，并且不把堆栈泄露给浏览器。
 */
export function createHttpErrorHandler(serviceName) {
    return function handleHttpError(error, request, response, next) {
        if (response.headersSent) {
            next(error);
            return;
        }

        console.error(
            styleText("red", `[${serviceName}] ${request.method} ${request.originalUrl} 失败：`),
            describeErrorChain(error),
        );

        response.status(400).type("text/plain; charset=utf-8").send(`${serviceName} 处理失败：${error.message}`);
    };
}

/*
 * 日志里展开整条 cause 链，浏览器只拿到最外层的一句话。
 */
function describeErrorChain(error) {
    const messages = [];

    for (let current = error; current instanceof Error; current = current.cause) {
        messages.push(current.message);
    }

    return messages.join(" ← ");
}
