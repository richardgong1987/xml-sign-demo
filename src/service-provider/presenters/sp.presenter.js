/*
 * A presenter answers two questions only: which template, and what data it needs.
 * The HTML lives in the EJS templates under views/, and EJS's <%= %> does the escaping.
 */

const PROFILE_FIELDS = Object.freeze([
    { key: "nameId", label: "NameID" },
    { key: "uid", label: "uid" },
    { key: "email", label: "email" },
    { key: "role", label: "role" },
    { key: "sessionIndex", label: "SessionIndex" },
]);

export function toHomePageView() {
    return { view: "home", model: {} };
}

export function toProfilePageView(authenticatedUser) {
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

