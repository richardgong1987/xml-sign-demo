/**
 * ClockPort 的生产实现。
 *
 * 业务代码通过它取时间，测试可以换成固定时间的实现，
 * 于是 Assertion 的有效期判断变得可断言。
 *
 * @type {{ now: () => Date }}
 */
export const systemClock = Object.freeze({
    now: () => new Date(),
});

