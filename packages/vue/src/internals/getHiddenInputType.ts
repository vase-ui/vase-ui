/**
 * The visually hidden input of a control without a native input (Select, Combobox) is only needed
 * for submission, constraint validation, autofill or Field validation.
 * Otherwise it can be `type="hidden"`, which password managers skip instead of treating each one
 * as a form field and rescanning the page whenever one is added or removed.
 *
 * Base UI also keeps a text input when the consumer gives `inputRef`. A part cannot know if a
 * consumer reads its exposed `inputElement`, so the function has no parameter for it.
 */
export function getHiddenInputType(
  inField: boolean,
  name: string | undefined,
  autoComplete: string | undefined,
  required: boolean,
) {
  return inField || name || autoComplete || required ? undefined : 'hidden';
}
