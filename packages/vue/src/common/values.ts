/** Two values are the same. Two arrays are the same when they have the same items. */
export function sameValue(a: unknown, b: unknown) {
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((item) => b.includes(item));
  }
  return Object.is(a, b);
}
