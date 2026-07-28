"use client";

import {useCallback, useEffect, useState} from "react";

import type {ProfileResponse} from "../../src/presenters/profile.presenter";
import {ACCESS_TOKEN_KEY} from "../../src/access-token-storage";

type Status = "checking" | "signed-in";

/**
 * Asks /api/me with the token kept in localStorage. Anything other than 200 means there
 * is no valid sign-in, so it drops the token and starts SSO again — a 401 and a missing
 * token lead to exactly the same place.
 */
export function SignedInUser() {
    const [status, setStatus] = useState<Status>("checking");
    const [profile, setProfile] = useState<ProfileResponse>({fields: []});

    const startSingleSignOn = useCallback(() => {
        localStorage.removeItem(ACCESS_TOKEN_KEY);
        location.replace(`/login?returnTo=${encodeURIComponent(location.pathname)}`);
    }, []);

    useEffect(() => {
        const accessToken = localStorage.getItem(ACCESS_TOKEN_KEY);

        if (!accessToken) {
            startSingleSignOn();
            return;
        }

        void fetch("/api/me", {headers: {authorization: `Bearer ${accessToken}`}})
            .then(async (response) => {
                if (!response.ok) {
                    startSingleSignOn();
                    return;
                }

                setProfile((await response.json()) as ProfileResponse);
                setStatus("signed-in");
            })
            .catch(startSingleSignOn);
    }, [startSingleSignOn]);

    // Signing out is purely local: the token is self-contained, so there is nothing on
    // the server to invalidate.
    const signOut = () => {
        localStorage.removeItem(ACCESS_TOKEN_KEY);
        location.replace("/");
    };

    if (status === "checking") {
        return <p>Checking the access token…</p>;
    }

    return (
        <>
            <p>
                Everything below travelled in the assertion the IdP signed, and now rides in this
                SP&apos;s own JWT.
            </p>

            <table>
                <tbody>
                    {profile.fields.map((field) => (
                        <tr key={field.label}>
                            <td>{field.label}</td>
                            <td>{field.value}</td>
                        </tr>
                    ))}
                </tbody>
            </table>

            <p>
                <button type="button" onClick={signOut}>
                    Sign out
                </button>
            </p>
        </>
    );
}
