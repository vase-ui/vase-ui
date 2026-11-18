/**
 * A control uses a text input for form submission, validation or autofill.
 * Otherwise it can use a hidden input, which password managers skip.
 */
export function getHiddenInputType(
  inField: boolean,
  name: string | undefined,
  autoComplete: string | undefined,
  required: boolean,
) {
  return inField || name || autoComplete || required ? undefined : 'hidden';
}
