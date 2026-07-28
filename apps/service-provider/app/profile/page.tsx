import {SignedInUser} from "./signed-in-user";

/*
 * A shell only. The server has no idea whether this browser is signed in — that is the
 * whole point of a self-contained token. Everything below happens in the browser.
 */
export default function ProfilePage() {
    return (
        <>
            <h1>Signed in</h1>
            <SignedInUser />
        </>
    );
}
