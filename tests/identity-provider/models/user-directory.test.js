import test from "node:test";
import assert from "node:assert/strict";

import {
    listUsers,
    findUser,
    UnknownUserError,
} from "../../../src/identity-provider/models/user-directory.js";

test("列出所有可登录的演示用户", () => {
    const uids = listUsers().map((user) => user.uid);

    assert.deepEqual(uids, ["hanjin", "sakura"]);
});

test("按 uid 找到用户及其属性", () => {
    const user = findUser("hanjin");

    assert.equal(user.email, "hanjin@example.test");
    assert.equal(user.role, "trader");
});

test("未知 uid 抛出 UnknownUserError", () => {
    assert.throws(() => findUser("nobody"), UnknownUserError);
});

test("不把 Object 原型上的属性当成用户", () => {
    assert.throws(() => findUser("toString"), UnknownUserError);
    assert.throws(() => findUser("constructor"), UnknownUserError);
});
