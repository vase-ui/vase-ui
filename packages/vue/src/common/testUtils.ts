// There is no jsdom here. The constant keeps the `skipIf(isJSDOM)` call of each ported test.
export const isJSDOM = false;

// https://stackoverflow.com/questions/53807517/how-to-test-if-two-types-are-exactly-the-same
export type IfEquals<T, U, Y = unknown, N = never> =
  (<G>() => G extends T ? 1 : 2) extends <G>() => G extends U ? 1 : 2 ? Y : N;

/**
 * Makes a type error if `Expected` is not identical to `Actual`.
 *
 * Declare `Expected` when you call `expectType`.
 * `Actual` is almost always `typeof value`.
 *
 * @example `expectType<number | string, typeof value>(value)`
 * If `typeof value` is not identical to `number | string`, `value` is not assignable to `never`.
 * TypeScript then shows a type error.
 */
export function expectType<Expected, Actual>(_actual: IfEquals<Actual, Expected, Actual>): void {}
