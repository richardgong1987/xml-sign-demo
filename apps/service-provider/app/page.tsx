import {TokenHint} from "./token-hint";

/*
 * A server component: it knows nothing about whether this browser is signed in, because
 * the SP keeps no session. Only the small client component below can look.
 */
export default function HomePage() {
    return (
        <>
            <h1>JSL-online (SP)</h1>

            <TokenHint />

            <p>
                <a href="/login">Sign in through Demo OpenAM</a>
            </p>

            <h2>SAML endpoints this SP exposes</h2>
            <ul>
                <li>
                    <code>GET /api/saml/metadata</code> — SP metadata, to be registered with the IdP
                </li>
                <li>
                    <code>POST /api/saml/acs</code> — receives the SAMLResponse delivered by the IdP
                </li>
            </ul>

            <h2>Its own API</h2>
            <ul>
                <li>
                    <code>GET /api/me</code> — requires <code>Authorization: Bearer &lt;jwt&gt;</code>
                </li>
            </ul>
        </>
    );
}
