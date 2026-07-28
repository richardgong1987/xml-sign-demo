import {DirectoryUser, UnknownUserError, UserDirectory} from "./user-directory";

describe("UserDirectory", () => {
    const users = new UserDirectory();
    const [firstUser] = users.list() as DirectoryUser[];

    it("lists at least one demo user who can sign in", () => {
        expect(users.list().length).toBeGreaterThan(0);
    });

    it("finds a user and their attributes by uid", () => {
        expect(users.find(firstUser.uid)).toEqual(firstUser);
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
