import {AuthenticatedUser} from "../models/authenticated-user";

/*
 * A presenter turns a use-case result into exactly the data one template needs.
 * The HTML lives in the EJS templates under views/, and EJS's <%= %> does the escaping.
 */

export interface ProfileField {
    readonly label: string;
    readonly value: string;
}

export interface ProfilePageModel {
    readonly fields: readonly ProfileField[];
}

const PROFILE_FIELDS: readonly { key: keyof AuthenticatedUser; label: string }[] = Object.freeze([
    {key: "nameId", label: "NameID"},
    {key: "uid", label: "uid"},
    {key: "email", label: "email"},
    {key: "role", label: "role"},
    {key: "sessionIndex", label: "SessionIndex"},
]);

export function toProfilePageModel(user: AuthenticatedUser): ProfilePageModel {
    return {
        fields: PROFILE_FIELDS.map(({key, label}) => ({label, value: user[key]})),
    };
}
