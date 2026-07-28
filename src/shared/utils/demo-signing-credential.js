import selfsigned from "selfsigned";

const CERTIFICATE_VALID_DAYS = 1;

/**
 * In production the IdP's private key and certificate are issued by a corporate PKI
 * and stay on the IdP side; the SP receives nothing but the certificate.
 *
 * This demo mints a throwaway pair on every start so that no private key has to be
 * committed to the repository. The cost: assertions issued before a restart no
 * longer verify afterwards.
 *
 * @returns {Promise<{ privateKeyPem: string, certificatePem: string }>}
 */
export async function createDemoSigningCredential(commonName) {
    const pems = await selfsigned.generate([{ name: "commonName", value: commonName }], {
        keySize: 2048,
        algorithm: "sha256",
        notAfterDate: daysFromNow(CERTIFICATE_VALID_DAYS),
    });

    return Object.freeze({
        privateKeyPem: pems.private,
        certificatePem: pems.cert,
    });
}

function daysFromNow(days) {
    return new Date(Date.now() + days * 24 * 60 * 60_000);
}
