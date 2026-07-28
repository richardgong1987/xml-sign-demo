import test from "node:test";
import assert from "node:assert/strict";

import {
    createAuthenticatedUser,
    InvalidAuthenticatedUserError,
} from "../../../src/service-provider/models/authenticated-user.js";

const VALID_PROFILE = Object.freeze({
    nameId: "hanjin",
    uid: "hanjin",
    email: "hanjin@example.test",
    role: "trader",
    sessionIndex: "_session-1",
});

test("keeps the identity fields carried by the assertion", () => {
    const user = createAuthenticatedUser(VALID_PROFILE);

    assert.equal(user.nameId, "hanjin");
    assert.equal(user.role, "trader");
    assert.equal(user.sessionIndex, "_session-1");
});

test("refuses to be created without a NameID", () => {
    assert.throws(
        () => createAuthenticatedUser({ ...VALID_PROFILE, nameId: "" }),
        InvalidAuthenticatedUserError,
    );
});

test("cannot be modified after creation", () => {
    const user = createAuthenticatedUser(VALID_PROFILE);

    assert.throws(() => {
        user.role = "administrator";
    }, TypeError);
});
