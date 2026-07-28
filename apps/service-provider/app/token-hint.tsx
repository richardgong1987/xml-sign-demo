"use client";

import {useEffect, useState} from "react";

import {ACCESS_TOKEN_KEY} from "../src/access-token-storage";

/**
 * Whether a token is present says nothing about whether it is still valid; only
 * /api/me can answer that. This is just a hint on the landing page.
 *
 * Reading localStorage has to happen after hydration, or the server-rendered markup and
 * the client's first render would disagree.
 */
export function TokenHint() {
    const [hasToken, setHasToken] = useState(false);

    useEffect(() => {
        setHasToken(localStorage.getItem(ACCESS_TOKEN_KEY) !== null);
    }, []);

    return hasToken ? (
        <p>An access token is present — open <a href="/profile">/profile</a> to have it verified.</p>
    ) : (
        <p>Not signed in.</p>
    );
}
