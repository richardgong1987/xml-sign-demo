const PEM_HEADERS = /-----(BEGIN|END) CERTIFICATE-----/g;
const BASE64_LINE_LENGTH = 64;

/*
 * SAML metadata 的 <ds:X509Certificate> 里放的是去掉 PEM 头尾和换行的 Base64 正文。
 */
export function toCertificateBody(certificatePem) {
    return certificatePem.replace(PEM_HEADERS, "").replace(/\s+/g, "");
}

export function toCertificatePem(certificateBody) {
    const lines = certificateBody.match(new RegExp(`.{1,${BASE64_LINE_LENGTH}}`, "g")) ?? [];

    return [
        "-----BEGIN CERTIFICATE-----",
        ...lines,
        "-----END CERTIFICATE-----",
        "",
    ].join("\n");
}

