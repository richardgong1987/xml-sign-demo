import selfsigned from "selfsigned";

const CERTIFICATE_VALID_DAYS = 1;

/**
 * 生产环境中，IdP 的私钥与证书由企业 PKI 签发，长期保存在 IdP 一侧，
 * SP 只拿到证书。
 *
 * Demo 每次启动临时生成一份，避免把私钥文件提交进仓库。
 * 代价是：重启后之前签发的 Assertion 全部失效。
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

