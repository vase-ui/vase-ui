/**
 * The option of a list or of a column that takes the focus: the selected option, or else the first
 * option that is not disabled.
 */
export function findOptionToFocus(root: HTMLElement | null | undefined): HTMLElement | undefined {
  const options = [...(root?.querySelectorAll<HTMLElement>('[role="option"]') ?? [])];
  const enabled = options.filter((option) => option.getAttribute('aria-disabled') !== 'true');
  return enabled.find((option) => option.getAttribute('aria-selected') === 'true') ?? enabled[0];
}
