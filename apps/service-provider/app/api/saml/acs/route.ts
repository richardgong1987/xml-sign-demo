import {getServiceProvider} from "../../../../src/service-provider.runtime";
import {renderTokenHandoffPage} from "../../../../src/token-handoff.page";

// node-saml and xml-crypto need Node APIs, so this cannot run on the edge runtime.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The Assertion Consumer Service.
 *
 * Verifies the signature and every SAML condition, then converts the assertion into the
 * SP's own JWT and hands it to the browser. A rejected assertion answers 400 and mints
 * nothing.
 */
export async function POST(request: Request): Promise<Response> {
    const {completeSingleSignOn} = await getServiceProvider();
    const form = await request.formData();

    try {
        const completed = await completeSingleSignOn.execute({
            samlResponse: String(form.get("SAMLResponse") ?? ""),
            relayState: String(form.get("RelayState") ?? ""),
        });

        return new Response(renderTokenHandoffPage(completed), {
            headers: {"content-type": "text/html; charset=utf-8"},
        });
    } catch (error) {
        console.warn("[SP] POST /api/saml/acs failed:", describeErrorChain(error));

        return new Response(`SP rejected the request: ${messageOf(error)}`, {
            status: 400,
            headers: {"content-type": "text/plain; charset=utf-8"},
        });
    }
}

/** Unfolds the whole cause chain into the log; the browser only sees the outer message. */
function describeErrorChain(error: unknown): string {
    const messages: string[] = [];

    for (let current = error; current instanceof Error; current = current.cause) {
        messages.push(current.message);
    }

    return messages.length > 0 ? messages.join(" <- ") : String(error);
}

function messageOf(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}
