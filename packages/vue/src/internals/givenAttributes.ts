function isBlank(value: unknown): boolean {
  return typeof value === 'string' && value.trim() === '';
}

// `undefined` is not given for each attribute, so it has no entry (`VUE-103`).
// `form` has no entry: an empty `form` has a meaning in HTML. The control then has no form owner.
const BLANK_IS_NOT_GIVEN = [
  // HTML requires at least one character in an id and allows no white space in it. White space
  // separates the ids of an ID reference, so no reference can name a blank id (`VUE-93`).
  'id',
  // A blank name gives an element no accessible name (`VUE-106`).
  'aria-label',
  'aria-labelledby',
  // A blank ID reference refers to no element (`VUE-110`). These are the other ID reference
  // attributes of WAI-ARIA 1.2, and `for` of HTML.
  'aria-activedescendant',
  'aria-controls',
  'aria-describedby',
  'aria-details',
  'aria-errormessage',
  'aria-flowto',
  'aria-owns',
  'for',
] as const;

// A `Set` has no key that an object inherits, such as `constructor`.
const blankIsNotGiven = new Set<string>(BLANK_IS_NOT_GIVEN);

function isGiven(attribute: string, value: unknown): boolean {
  return value !== undefined && !(blankIsNotGiven.has(attribute) && isBlank(value));
}

/**
 * Returns `value`, or `undefined` when the value counts as not given for `attribute`.
 * The part then keeps its own value, as if the consumer gave none.
 * Use it for a value that the `props` function of `useRenderElement` does not get: a declared
 * prop, an attribute that a part reads with `useAttrs()`, or a parameter of a composable.
 */
export function given<Value>(
  attribute: (typeof BLANK_IS_NOT_GIVEN)[number],
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
