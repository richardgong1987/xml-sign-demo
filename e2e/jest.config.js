/**
 * Boots both applications for real, so it is slow and must not run in parallel with
 * itself — the two servers bind fixed ports.
 *
 * @type {import("jest").Config}
 */
module.exports = {
    rootDir: ".",
    testEnvironment: "node",
    testRegex: ".*\\.e2e-spec\\.ts$",
    transform: {"^.+\\.ts$": ["ts-jest", {tsconfig: "tsconfig.json"}]},
    moduleFileExtensions: ["ts", "js", "json"],
    globalSetup: "<rootDir>/global-setup.ts",
    globalTeardown: "<rootDir>/global-teardown.ts",
    testTimeout: 30_000,
    clearMocks: true,
};
