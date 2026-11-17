/**
 * The option of a list or of a column that takes the focus: the selected option, or else the first
 * option that is not disabled.
 */
export function findOptionToFocus(
  options: readonly (HTMLElement | null | undefined)[],
): HTMLElement | undefined {
  let firstEnabled: HTMLElement | undefined;
  for (const option of options) {
    if (!option || option.getAttribute('aria-disabled') === 'true') {
      continue;
    }
    if (option.getAttribute('aria-selected') === 'true') {
      return option;
    }
    firstEnabled ??= option;
  }
  return firstEnabled;
}
