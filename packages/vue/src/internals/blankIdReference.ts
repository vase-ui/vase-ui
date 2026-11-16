import { isBlank } from './blankName';

// Each attribute of WAI-ARIA 1.2 whose value is an ID reference or a list of ID references, and
// `for` of HTML. `aria-labelledby` is in `blankName.ts`, because it gives a name.
// `form` is not here: an empty `form` has a meaning in HTML. The control then has no form owner.
const ID_REFERENCE_ATTRIBUTES = [
  'aria-activedescendant',
  'aria-controls',
  'aria-describedby',
  'aria-details',
  'aria-errormessage',
  'aria-flowto',
  'aria-owns',
  'for',
] as const;

/**
 * Returns the ID reference that the consumer gave, or `undefined` for a blank value: an empty
 * string, or a string of white space only.
 * A blank value refers to no element, so it counts as not given (`VUE-110`).
 * Use it for a declared prop, such as `ariaDescribedby`. The `props` function of `useRenderElement`
 * gets no blank ID reference, so a call there is not needed.
 */
export function givenIdReference<IdReference>(idReference: IdReference): IdReference | undefined {
  return isBlank(idReference) ? undefined : idReference;
}

/**
 * Removes each blank ID reference attribute from `attrs`, the attributes of the consumer. The
 * value of the part then stays (`VUE-110`).
 */
export function removeBlankIdReferences(attrs: Record<string, unknown>): void {
  for (const key of ID_REFERENCE_ATTRIBUTES) {
    if (isBlank(attrs[key])) {
      delete attrs[key];
    }
  }
}
