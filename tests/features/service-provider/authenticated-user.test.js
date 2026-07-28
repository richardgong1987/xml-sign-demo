"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
    createAuthenticatedUser,
    InvalidAuthenticatedUserError,
} = require("../../../src/features/service-provider/authenticated-user");

const VALID_PROFILE = Object.freeze({
    nameId: "hanjin",
    uid: "hanjin",
    email: "hanjin@example.test",
    role: "trader",
    sessionIndex: "_session-1",
});

test("保留断言里的身份字段", () => {
    const user = createAuthenticatedUser(VALID_PROFILE);

    assert.equal(user.nameId, "hanjin");
    assert.equal(user.role, "trader");
    assert.equal(user.sessionIndex, "_session-1");
});

test("缺少 NameID 时拒绝创建", () => {
    assert.throws(
        () => createAuthenticatedUser({ ...VALID_PROFILE, nameId: "" }),
        InvalidAuthenticatedUserError,
    );
});

test("创建之后不可修改", () => {
    const user = createAuthenticatedUser(VALID_PROFILE);

    assert.throws(() => {
        user.role = "administrator";
    }, TypeError);
});
