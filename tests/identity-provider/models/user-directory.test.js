import test from "node:test";
import assert from "node:assert/strict";

import {
    listUsers,
    findUser,
    UnknownUserError,
} from "../../../src/identity-provider/models/user-directory.js";

test("lists every demo user who can sign in", () => {
    const uids = listUsers().map((user) => user.uid);

    assert.deepEqual(uids, ["hanjin", "sakura"]);
});

test("finds a user and their attributes by uid", () => {
    const user = findUser("hanjin");

    assert.equal(user.email, "hanjin@example.test");
    assert.equal(user.role, "trader");
});

test("throws UnknownUserError for an unknown uid", () => {
    assert.throws(() => findUser("nobody"), UnknownUserError);
});

test("does not mistake Object prototype members for users", () => {
    assert.throws(() => findUser("toString"), UnknownUserError);
    assert.throws(() => findUser("constructor"), UnknownUserError);
});
