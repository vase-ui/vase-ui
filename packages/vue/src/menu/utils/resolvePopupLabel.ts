/**
 * Returns the `aria-labelledby` of the part that has the `menu` role: the popup, or `Menu.List`.
 * An `aria-label` or an `aria-labelledby` of the consumer replaces the label from the trigger. The
 * part reads only its own attributes, because it does not see an attribute that a `#render` slot
 * adds.
 */
export function resolvePopupLabel(
  attrs: Record<string, unknown>,
  activeTriggerElement: Element | null,
  activeTriggerId: string | null,
) {
  const ariaLabelledBy = attrs['aria-labelledby'] as string | undefined;
  if (ariaLabelledBy != null || attrs['aria-label']) {
    return ariaLabelledBy;
  }

  // Prefer the live id of the element: the own `id` of an element from a `#render` slot wins over
  // the registered one.
  return (activeTriggerElement ? activeTriggerElement.id : activeTriggerId) || undefined;
}
