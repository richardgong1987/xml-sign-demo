"use strict";

/*
 * Presenter 只回答两件事：用哪个模板，模板需要哪些数据。
 * HTML 在 views/ 下的 EJS 模板里，转义由 EJS 的 <%= %> 负责。
 */

const PROFILE_FIELDS = Object.freeze([
    { key: "nameId", label: "NameID" },
    { key: "uid", label: "uid" },
    { key: "email", label: "email" },
    { key: "role", label: "role" },
    { key: "sessionIndex", label: "SessionIndex" },
]);

function toHomePageView() {
    return { view: "home", model: {} };
}

function toProfilePageView(authenticatedUser) {
    return {
        view: "profile",
        model: {
            fields: PROFILE_FIELDS.map(({ key, label }) => ({
                label,
                value: authenticatedUser[key],
            })),
        },
    };
}

module.exports = { toHomePageView, toProfilePageView };
