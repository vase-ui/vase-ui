type NotGivenTest = (value: unknown) => boolean;

const isEmpty: NotGivenTest = (value) => value === '';
const isBlank: NotGivenTest = (value) => typeof value === 'string' && value.trim() === '';

// A row is an attribute that has a value that is not given, with the test for that value.
// `undefined` is not given for each attribute, so it has no row (`VUE-103`).
// `form` has no row: an empty `form` has a meaning in HTML. The control then has no form owner.
const NOT_GIVEN_TESTS = [
  // HTML requires at least one character in an id, and an ID reference cannot name an empty id
  // (`VUE-93`). An `id` of white space only stays, as in Base UI.
  ['id', isEmpty],
  // A blank name gives an element no accessible name (`VUE-106`).
  ['aria-label', isBlank],
  ['aria-labelledby', isBlank],
  // A blank ID reference refers to no element (`VUE-110`). These are the other ID reference
  // attributes of WAI-ARIA 1.2, and `for` of HTML.
  ['aria-activedescendant', isBlank],
  ['aria-controls', isBlank],
  ['aria-describedby', isBlank],
  ['aria-details', isBlank],
  ['aria-errormessage', isBlank],
  ['aria-flowto', isBlank],
  ['aria-owns', isBlank],
  ['for', isBlank],
] as const;

// A `Map` has no key that an object inherits, such as `constructor`.
const NOT_GIVEN = new Map<string, NotGivenTest>(NOT_GIVEN_TESTS);

function isGiven(attribute: string, value: unknown): boolean {
  return value !== undefined && !NOT_GIVEN.get(attribute)?.(value);
}

/**
 * Returns `value`, or `undefined` when the value counts as not given for `attribute`.
 * The part then keeps its own value, as if the consumer gave none.
 * Use it for a value that the `props` function of `useRenderElement` does not get: a declared
 * prop, an attribute that a part reads with `useAttrs()`, or a parameter of a composable.
 */
export function given<Value>(
  attribute: (typeof NOT_GIVEN_TESTS)[number][0],
  value: Value,
): Value | undefined {
  return isGiven(attribute, value) ? value : undefined;
}

/**
 * Returns a copy of `attrs`, the attributes of the consumer, without each attribute whose value
 * counts as not given. `null` stays: it removes the value of the part.
 */
export function givenAttributes(attrs: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [attribute, value] of Object.entries(attrs)) {
    if (isGiven(attribute, value)) {
      result[attribute] = value;
    }
  }
  return result;
}
