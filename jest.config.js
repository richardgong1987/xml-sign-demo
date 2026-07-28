/**
 * Unit specs live next to the code they cover (`src/**‍/*.spec.ts`); the end-to-end
 * suite boots both real applications and lives in `test/`.
 *
 * @type {import("jest").Config}
 */
module.exports = {
    rootDir: ".",
    testEnvironment: "node",
    roots: ["<rootDir>/src", "<rootDir>/test"],
    testRegex: ".*\\.(spec|e2e-spec)\\.ts$",
    transform: { "^.+\\.ts$": ["ts-jest", { tsconfig: "tsconfig.json" }] },
    moduleFileExtensions: ["ts", "js", "json"],
    clearMocks: true,
};
