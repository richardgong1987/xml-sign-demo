/**
 * A port: applies an XML digital signature to the assertion inside a SAMLResponse.
 *
 * Declared as an abstract class so it exists at runtime and can serve as an injection
 * token. The use case depends on this; only the module knows which implementation
 * is bound to it.
 */
export abstract class AssertionSigner {
    abstract signAssertion(samlResponseXml: string): string;
}
