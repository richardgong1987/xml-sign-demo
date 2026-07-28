/**
 * Only the framework-agnostic half is unit-tested here: domain, use cases, the JWT
 * issuer. Route handlers and pages are covered by the repository-level `e2e/` package,
 * which drives a real `next start`.
 *
 * `jose` ships as ES modules only, so it has to be transformed alongside our own
 * sources rather than left in the default node_modules blind spot.
 *
 * @type {import("jest").Config}
 */
module.exports = {
    rootDir: ".",
    testEnvironment: "node",
    roots: ["<rootDir>/src"],
    testRegex: ".*\\.spec\\.ts$",
    transform: {
        "^.+\\.[tj]s$": [
            "ts-jest",
            {tsconfig: {module: "commonjs", esModuleInterop: true, allowJs: true, target: "ES2023"}},
        ],
    },
    transformIgnorePatterns: ["/node_modules/(?!jose)"],
    moduleFileExtensions: ["ts", "js", "json"],
    clearMocks: true,
};
