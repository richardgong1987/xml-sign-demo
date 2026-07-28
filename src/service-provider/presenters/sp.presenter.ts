import {AuthenticatedUser} from "../models/authenticated-user";

/*
 * A presenter turns a use-case result into exactly the data one consumer needs — a
 * template, or in the case of /api/me a JSON body the page's own script renders.
 */

export interface ProfileField {
    readonly label: string;
    readonly value: string;
}

export interface ProfileResponse {
    readonly fields: readonly ProfileField[];
}

/** What the SAML hand-off page needs to move the token into localStorage. */
export interface TokenHandoffModel {
    readonly accessToken: string;
    readonly returnTo: string;
}

const PROFILE_FIELDS: readonly { key: keyof AuthenticatedUser; label: string }[] = Object.freeze([
    {key: "nameId", label: "NameID"},
    {key: "uid", label: "uid"},
    {key: "email", label: "email"},
    {key: "role", label: "role"},
    {key: "sessionIndex", label: "SessionIndex"},
]);

export function toProfileResponse(user: AuthenticatedUser): ProfileResponse {
    return {
        fields: PROFILE_FIELDS.map(({key, label}) => ({label, value: user[key]})),
    };
}
