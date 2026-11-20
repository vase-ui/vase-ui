/**
 * Returns the `aria-labelledby` of a popup part that takes its name from its active trigger: the
 * part of Menu that has the `menu` role (the popup or `Menu.List`).
 * A non-blank `aria-label` or `aria-labelledby` of the part replaces the label from the trigger.
 * The part reads only its own attributes. An `aria-labelledby` on the element of a `#render` slot
 * also replaces the label, because the element sets it after the props. An `aria-label` on that
 * element does not, because the part does not see it. The part then keeps the `aria-labelledby` of
 * the trigger.
 *
 * `triggerId` is the `id` of the active trigger. It comes from a ref that follows each change of
 * the `id` attribute of the trigger element, such as the ref of `useElementId`. A part that reads
 * the `id` of the element in its render does not render again when the attribute changes.
 */
export function resolvePopupLabel(
  attrs: Record<string, unknown>,
  triggerId: string | null | undefined,
) {
  const ariaLabelledBy = attrs['aria-labelledby'] as string | undefined;
  if (ariaLabelledBy != null || attrs['aria-label']) {
    return ariaLabelledBy;
  }

  return triggerId || undefined;
}
