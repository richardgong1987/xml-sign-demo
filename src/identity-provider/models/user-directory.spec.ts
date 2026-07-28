import { UnknownUserError, UserDirectory } from "./user-directory";

describe("UserDirectory", () => {
    const users = new UserDirectory();

    it("lists every demo user who can sign in", () => {
        expect(users.list().map((user) => user.uid)).toEqual(["hanjin", "sakura"]);
    });

    it("finds a user and their attributes by uid", () => {
        expect(users.find("hanjin")).toEqual({
            uid: "hanjin",
            email: "hanjin@example.test",
            role: "trader",
        });
    });

    it("throws UnknownUserError for an unknown uid", () => {
        expect(() => users.find("nobody")).toThrow(UnknownUserError);
    });

    it.each(["toString", "constructor", "__proto__"])(
        "does not mistake the prototype member %s for a user",
        (member) => {
            expect(() => users.find(member)).toThrow(UnknownUserError);
        },
    );
});
