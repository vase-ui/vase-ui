/**
 * Returns the `aria-labelledby` of the part that has the `menu` role: the popup, or `Menu.List`.
 * An `aria-label` or an `aria-labelledby` of the part replaces the label from the trigger. The part
 * reads only its own attributes. An `aria-labelledby` on the element of a `#render` slot also
 * replaces the label, because the element sets it after the props. An `aria-label` on that element
 * does not, because the part does not see it. The part then keeps the `aria-labelledby` of the
 * trigger.
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
