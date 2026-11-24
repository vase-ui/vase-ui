const ariaText = (text: unknown) =>
  typeof text === 'string' && text.trim() !== '' ? text : undefined;

/**
 * The order follows AccName 1.2: `labelledBy` is `aria-labelledby` of the control, and
 * `fallbackLabelledBy` is a native label.
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
