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
 * If `typeof value` is not identical to `number | string`, the call needs a second argument.
 * TypeScript then reports TS2554: "Expected 2 arguments, but got 1."
 * The helper counts the arguments, because no parameter type can refuse a `never` value.
 */
export function expectType<Expected, Actual>(
  ..._actual: IfEquals<Actual, Expected, [actual: Actual], [actual: Actual, typeMismatch: never]>
): void {}
