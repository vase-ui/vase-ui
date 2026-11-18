/**
 * The option of a list or of a column that takes the focus: the selected option, or else the first
 * option that is not disabled.
 * @param options The elements that the composite root of the list or of the column holds, in the
 * order of their indexes. An empty slot does not count.
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
