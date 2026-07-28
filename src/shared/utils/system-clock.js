/**
 * Production implementation of ClockPort.
 *
 * Business code reads the time through this port, so tests can substitute a fixed
 * clock — which is what makes assertion validity windows assertable.
 *
 * @type {{ now: () => Date }}
 */
export const systemClock = Object.freeze({
    now: () => new Date(),
});
