import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from "@nestjs/common";
import { Response } from "express";

/**
 * Error translation at the boundary.
 *
 * Anything that is not already an HttpException is a rejected SAML exchange — a
 * malformed AuthnRequest, a bad signature, a replayed assertion. The browser gets a
 * plain 400 with the outermost message; the log gets the whole cause chain.
 *
 * Surfacing the reason to the browser is a deliberate choice for a teaching demo. A
 * production SP would show a generic failure page and keep the detail in the log.
 */
@Catch()
export class SamlFailureFilter implements ExceptionFilter {
    private readonly logger: Logger;

    constructor(private readonly serviceName: string) {
        this.logger = new Logger(serviceName);
    }

    catch(exception: unknown, host: ArgumentsHost): void {
        const context = host.switchToHttp();
        const response = context.getResponse<Response>();
        const request = context.getRequest<{ method: string; originalUrl: string }>();

        if (exception instanceof HttpException) {
            response.status(exception.getStatus()).send(exception.message);
            return;
        }

        const chain = describeErrorChain(exception);
        this.logger.warn(`${request.method} ${request.originalUrl} failed: ${chain}`);

        response
            .status(400)
            .type("text/plain; charset=utf-8")
            .send(`${this.serviceName} rejected the request: ${messageOf(exception)}`);
    }
}

function describeErrorChain(exception: unknown): string {
    const messages: string[] = [];

    for (let current = exception; current instanceof Error; current = current.cause) {
        messages.push(current.message);
    }

    return messages.length > 0 ? messages.join(" <- ") : String(exception);
}

function messageOf(exception: unknown): string {
    return exception instanceof Error ? exception.message : String(exception);
}
