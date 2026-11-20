/**
 * Two values are the same. Two arrays are the same when each item is in both the same number of
 * times, in any order. No value (`null` or `undefined`) and an empty text are the same.
 */
export function sameValue(a: unknown, b: unknown) {
  if (Array.isArray(a) && Array.isArray(b)) {
    // `includes` compares by SameValueZero, so `NaN` is the same as `NaN`.
    const count = (list: unknown[], item: unknown) =>
      list.filter((other) => [other].includes(item)).length;
    return a.length === b.length && a.every((item) => count(a, item) === count(b, item));
  }
  return Object.is(a ?? '', b ?? '');
}
