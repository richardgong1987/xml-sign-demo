import { styleText } from "node:util";

/*
 * Error translation at the boundary: turn an internal error into an HTTP response
 * without leaking the stack trace to the browser.
 */
export function createHttpErrorHandler(serviceName) {
    return function handleHttpError(error, request, response, next) {
        if (response.headersSent) {
            next(error);
            return;
        }

        console.error(
            styleText("red", `[${serviceName}] ${request.method} ${request.originalUrl} failed:`),
            describeErrorChain(error),
        );

        response.status(400).type("text/plain; charset=utf-8").send(`${serviceName} rejected the request: ${error.message}`);
    };
}

/*
 * Unfold the whole cause chain into the log; the browser only sees the outermost message.
 */
function describeErrorChain(error) {
    const messages = [];

    for (let current = error; current instanceof Error; current = current.cause) {
        messages.push(current.message);
    }

    return messages.join(" <- ");
}
