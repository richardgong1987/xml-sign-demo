import path from "node:path";
import type {NextConfig} from "next";

const nextConfig: NextConfig = {
    // node-saml, xml-crypto and xmldom are CommonJS packages that reach for Node APIs.
    // Leaving them external keeps the bundler from trying to trace and inline them.
    serverExternalPackages: ["@node-saml/node-saml", "xml-crypto", "@xmldom/xmldom", "xpath"],

    // Dependencies are hoisted to the workspace root, so file tracing has to start there.
    outputFileTracingRoot: path.join(__dirname, "..", ".."),
};

export default nextConfig;
