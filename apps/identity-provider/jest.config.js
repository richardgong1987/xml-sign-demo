/**
 * Unit specs live next to the code they cover. Cross-service end-to-end tests are not
 * here — they need the SP too, so they live in the repository-level `e2e/` package.
 *
 * @type {import("jest").Config}
 */
module.exports = {
    rootDir: ".",
    testEnvironment: "node",
    roots: ["<rootDir>/src"],
    testRegex: ".*\\.spec\\.ts$",
    transform: {"^.+\\.ts$": ["ts-jest", {tsconfig: "tsconfig.json"}]},
    moduleFileExtensions: ["ts", "js", "json"],
    clearMocks: true,
};
