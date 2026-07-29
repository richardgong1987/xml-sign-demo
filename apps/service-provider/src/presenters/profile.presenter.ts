import {AuthenticatedUser} from "../domain/authenticated-user";

/*
 * Turns the signed-in user into exactly what /api/me returns and the profile page
 * renders — the SP decides what to expose, not whatever the assertion happened to carry.
 */

export interface ProfileField {
    readonly label: string;
    readonly value: string;
}

export interface ProfileResponse {
    readonly fields: readonly ProfileField[];
}

const PROFILE_FIELDS: readonly { key: keyof AuthenticatedUser; label: string }[] = Object.freeze([
    {key: "nameId", label: "NameID"},
    {key: "uid", label: "uid"},
    {key: "email", label: "email"},
    {key: "role", label: "role"},
]);

export function toProfileResponse(user: AuthenticatedUser): ProfileResponse {
    return {fields: PROFILE_FIELDS.map(({key, label}) => ({label, value: user[key]}))};
}
