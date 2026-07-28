/*
 * RegExp.escape ships in Node 24 but is not yet in TypeScript's ESNext lib.
 * Remove this declaration once the lib catches up.
 */
declare global {
    interface RegExpConstructor {
        escape(value: string): string;
    }
}

export {};
