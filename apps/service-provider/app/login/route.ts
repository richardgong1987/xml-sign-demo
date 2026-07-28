import {NextResponse} from "next/server";

import {getServiceProvider} from "../../src/service-provider.runtime";

// node-saml needs Node APIs, and the AuthnRequest must be built per request.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Starts SSO. The page the user wanted travels in RelayState, which the IdP echoes back
 * untouched.
 */
export async function GET(request: Request): Promise<NextResponse> {
    const {startSingleSignOn} = await getServiceProvider();
    const returnTo = new URL(request.url).searchParams.get("returnTo") ?? "";

    return NextResponse.redirect(await startSingleSignOn.execute({returnTo}), 302);
}
