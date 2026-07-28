import { createSamlId } from "../../shared/utils/saml-id.js";

/**
 * 构造一份尚未签名的 SAMLResponse。
 *
 * 纯函数：不读时间、不读配置、不碰网络。时间由调用方通过 issuedAt 注入，
 * 因此可以对有效期规则写确定性的测试。
 *
 * @param {{
 *   identityProviderEntityId: string,
 *   serviceProvider: { entityId: string, assertionConsumerServiceUrl: string },
 *   user: { uid: string, email: string, role: string },
 *   authnRequestId: string,
 *   issuedAt: Date,
 *   assertionLifetimeMs: number,
 *   acceptedClockSkewMs: number,
 * }} params
 * @returns {string}
 */
export function createUnsignedSamlResponse(params) {
    const { identityProviderEntityId, serviceProvider, user, authnRequestId, issuedAt } = params;

    const issueInstant = issuedAt.toISOString();
    const notBefore = new Date(issuedAt.getTime() - params.acceptedClockSkewMs).toISOString();
    const notOnOrAfter = new Date(issuedAt.getTime() + params.assertionLifetimeMs).toISOString();

    return `
<samlp:Response
    xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol"
    xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion"
    ID="${createSamlId()}"
    Version="2.0"
    IssueInstant="${issueInstant}"
    InResponseTo="${authnRequestId}"
    Destination="${serviceProvider.assertionConsumerServiceUrl}">

  <saml:Issuer>${identityProviderEntityId}</saml:Issuer>

  <samlp:Status>
    <samlp:StatusCode Value="urn:oasis:names:tc:SAML:2.0:status:Success"/>
  </samlp:Status>

  <saml:Assertion ID="${createSamlId()}" Version="2.0" IssueInstant="${issueInstant}">

    <saml:Issuer>${identityProviderEntityId}</saml:Issuer>

    <saml:Subject>
      <saml:NameID Format="urn:oasis:names:tc:SAML:1.1:nameid-format:unspecified">${user.uid}</saml:NameID>
      <saml:SubjectConfirmation Method="urn:oasis:names:tc:SAML:2.0:cm:bearer">
        <saml:SubjectConfirmationData
            InResponseTo="${authnRequestId}"
            Recipient="${serviceProvider.assertionConsumerServiceUrl}"
            NotOnOrAfter="${notOnOrAfter}"/>
      </saml:SubjectConfirmation>
    </saml:Subject>

    <saml:Conditions NotBefore="${notBefore}" NotOnOrAfter="${notOnOrAfter}">
      <saml:AudienceRestriction>
        <saml:Audience>${serviceProvider.entityId}</saml:Audience>
      </saml:AudienceRestriction>
    </saml:Conditions>

    <saml:AuthnStatement AuthnInstant="${issueInstant}" SessionIndex="${createSamlId()}">
      <saml:AuthnContext>
        <saml:AuthnContextClassRef>urn:oasis:names:tc:SAML:2.0:ac:classes:PasswordProtectedTransport</saml:AuthnContextClassRef>
      </saml:AuthnContext>
    </saml:AuthnStatement>

    <saml:AttributeStatement>
${renderAttributes(user)}
    </saml:AttributeStatement>

  </saml:Assertion>
</samlp:Response>`.trim();
}

function renderAttributes(user) {
    return ["uid", "email", "role"]
        .map((name) => renderAttribute(name, user[name]))
        .join("\n");
}

function renderAttribute(name, value) {
    return `      <saml:Attribute Name="${name}">
        <saml:AttributeValue>${value}</saml:AttributeValue>
      </saml:Attribute>`;
}

