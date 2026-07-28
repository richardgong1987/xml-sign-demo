import {AuthenticatedUser, createAuthenticatedUser, InvalidAuthenticatedUserError,} from "./authenticated-user";

const VALID_PROFILE: AuthenticatedUser = {
    nameId: "hanjin",
    uid: "hanjin",
    email: "hanjin@example.test",
    role: "trader",
    sessionIndex: "_session-1",
};

describe("createAuthenticatedUser", () => {
    it("keeps the identity fields carried by the assertion", () => {
        expect(createAuthenticatedUser(VALID_PROFILE)).toEqual(VALID_PROFILE);
    });

    it("refuses to be created without a NameID", () => {
        expect(() => createAuthenticatedUser({...VALID_PROFILE, nameId: ""})).toThrow(
            InvalidAuthenticatedUserError,
        );
    });

    it("cannot be modified after creation", () => {
        const user = createAuthenticatedUser(VALID_PROFILE) as { role: string };

        expect(() => {
            user.role = "administrator";
        }).toThrow(TypeError);
    });
});
