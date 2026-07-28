const PEM_HEADERS = /-----(BEGIN|END) CERTIFICATE-----/g;
const BASE64_LINE_LENGTH = 64;

/*
 * <ds:X509Certificate> in SAML metadata carries the base64 body alone —
 * no PEM header, footer, or line breaks.
 */
export function toCertificateBody(certificatePem: string): string {
    return certificatePem.replace(PEM_HEADERS, "").replace(/\s+/g, "");
}

export function toCertificatePem(certificateBody: string): string {
    const lines = certificateBody.match(new RegExp(`.{1,${BASE64_LINE_LENGTH}}`, "g")) ?? [];

    return ["-----BEGIN CERTIFICATE-----", ...lines, "-----END CERTIFICATE-----", ""].join("\n");
}
