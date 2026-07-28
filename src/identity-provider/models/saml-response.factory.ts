import {RegisteredServiceProvider} from "../../config/saml.config";
import {createSamlId} from "../../shared/saml-id";
import {DirectoryUser} from "./user-directory";

export interface UnsignedSamlResponseSpec {
    readonly identityProviderEntityId: string;
    readonly serviceProvider: RegisteredServiceProvider;
    readonly user: DirectoryUser;
    readonly authnRequestId: string;
    readonly issuedAt: Date;
    readonly assertionLifetimeMs: number;
    readonly acceptedClockSkewMs: number;
}

/**
 * Builds an unsigned SAMLResponse.
 *
 * A pure function, deliberately not a provider: it reads no clock, no configuration,
 * and no network. The caller injects the time through issuedAt, which is what makes
 * the validity-window rules deterministically testable.
 */
export function createUnsignedSamlResponse(spec: UnsignedSamlResponseSpec): string {
    const {identityProviderEntityId, serviceProvider, user, authnRequestId, issuedAt} = spec;

    const issueInstant = issuedAt.toISOString();
    const notBefore = new Date(issuedAt.getTime() - spec.acceptedClockSkewMs).toISOString();
    const notOnOrAfter = new Date(issuedAt.getTime() + spec.assertionLifetimeMs).toISOString();

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

function renderAttributes(user: DirectoryUser): string {
    return (["uid", "email", "role"] as const)
        .map((name) => renderAttribute(name, user[name]))
        .join("\n");
}

function renderAttribute(name: string, value: string): string {
    return `      <saml:Attribute Name="${name}">
        <saml:AttributeValue>${value}</saml:AttributeValue>
      </saml:Attribute>`;
}
