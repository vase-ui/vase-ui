const NAME_ATTRIBUTES = ['aria-label', 'aria-labelledby'] as const;

/**
 * Returns `true` for a blank string: an empty string, or a string of white space only.
 */
export function isBlank(value: unknown): boolean {
  return typeof value === 'string' && value.trim() === '';
}

/**
 * Returns the `aria-label` or the `aria-labelledby` that the consumer gave, or `undefined` for a
 * blank value: an empty string, or a string of white space only.
 * A blank value gives an element no accessible name, so it counts as not given (`VUE-106`).
 * Use it for a declared prop and for an attribute that a part reads with `useAttrs()`. The `props`
 * function of `useRenderElement` gets no blank name, so a call there is not needed.
 */
export function givenName<Name>(name: Name): Name | undefined {
  return isBlank(name) ? undefined : name;
}

/**
 * Removes a blank `aria-label` and a blank `aria-labelledby` from `attrs`, the attributes of the
 * consumer. The value of the part then stays (`VUE-106`).
 */
export function removeBlankNames(attrs: Record<string, unknown>): void {
  for (const key of NAME_ATTRIBUTES) {
    if (isBlank(attrs[key])) {
      delete attrs[key];
    }
  }
}
