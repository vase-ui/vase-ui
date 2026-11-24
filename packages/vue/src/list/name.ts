const ariaText = (text: unknown) =>
  typeof text === 'string' && text.trim() !== '' ? text : undefined;

/**
 * The `aria-labelledby` or `aria-label` of a listbox or grid from its control, in the order of
 * AccName 1.2: `aria-labelledby` of the control (developer value, else `labelledBy`), else its
 * `aria-label`, else `fallbackLabelledBy`. A developer `aria-label` or `aria-labelledby` on the
 * list, also a blank one, stops both defaults.
 */
export function listNameFromControl(
  listAttrs: Record<string, unknown>,
  controlAttrs: Record<string, unknown> | undefined,
  labelledBy: string | undefined,
  fallbackLabelledBy: string | undefined,
): { 'aria-labelledby'?: string; 'aria-label'?: string } {
  if ('aria-label' in listAttrs || 'aria-labelledby' in listAttrs) return {};
  // Read through `get` before `in`: Vue's attrs proxy tracks reads in `get`, not in `has`.
  const givenLabelledBy = controlAttrs?.['aria-labelledby'];
  const hasGivenLabelledBy = !!controlAttrs && 'aria-labelledby' in controlAttrs;
  const ids = hasGivenLabelledBy ? ariaText(givenLabelledBy) : labelledBy;
  if (ids) return { 'aria-labelledby': ids };
  const label = ariaText(controlAttrs?.['aria-label']);
  if (label) return { 'aria-label': label };
  return fallbackLabelledBy ? { 'aria-labelledby': fallbackLabelledBy } : {};
}
