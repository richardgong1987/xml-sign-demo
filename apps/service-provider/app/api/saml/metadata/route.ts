import {getServiceProvider} from "../../../../src/service-provider.runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The SP's metadata. Nothing fetches this at runtime — it is what an administrator
 * hands to the IdP once, to register this service provider.
 */
export async function GET(): Promise<Response> {
    const {samlMetadataXml} = await getServiceProvider();

    return new Response(samlMetadataXml, {headers: {"content-type": "application/xml"}});
}
