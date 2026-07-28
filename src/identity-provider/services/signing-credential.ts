import selfsigned from "selfsigned";

const CERTIFICATE_VALID_DAYS = 1;

export interface SigningCredential {
    readonly privateKeyPem: string;
    readonly certificatePem: string;
}

export const SIGNING_CREDENTIAL = Symbol("SigningCredential");

/**
 * In production the IdP's private key and certificate are issued by a corporate PKI
 * and stay on the IdP side; the SP receives nothing but the certificate.
 *
 * This demo mints a throwaway pair on every start so that no private key has to be
 * committed to the repository. The cost: assertions issued before a restart no longer
 * verify afterwards.
 */
export async function createDemoSigningCredential(commonName: string): Promise<SigningCredential> {
    const pems = await selfsigned.generate([{name: "commonName", value: commonName}], {
        keySize: 2048,
        algorithm: "sha256",
        notAfterDate: daysFromNow(CERTIFICATE_VALID_DAYS),
    });

    return Object.freeze({privateKeyPem: pems.private, certificatePem: pems.cert});
}

function daysFromNow(days: number): Date {
    return new Date(Date.now() + days * 24 * 60 * 60_000);
}
