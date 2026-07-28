import {NextResponse} from "next/server";

import {readAuthenticatedUser} from "../../../src/bearer-token";
import {toProfileResponse} from "../../../src/presenters/profile.presenter";
import {getServiceProvider} from "../../../src/service-provider.runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The SP's own API. A valid signature and a live expiry is the whole definition of
 * "signed in" — there is no session to look up.
 */
export async function GET(request: Request): Promise<NextResponse> {
    const {config} = await getServiceProvider();
    const user = await readAuthenticatedUser(request, config);

    if (!user) {
        return NextResponse.json({message: "Missing or invalid access token"}, {status: 401});
    }

    return NextResponse.json(toProfileResponse(user));
}
