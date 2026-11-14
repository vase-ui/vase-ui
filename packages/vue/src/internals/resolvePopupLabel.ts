interface PopupLabelProps {
  'aria-label'?: string | undefined;
  'aria-labelledby'?: string | undefined;
}

/**
 * Gives the `aria-labelledby` of a popup. An `aria-label` or an `aria-labelledby` of the consumer
 * replaces the label from the trigger. The function reads only the attributes of the part, because
 * a part does not see an attribute that a `#render` slot adds.
 */
export function resolvePopupLabel(
  props: PopupLabelProps,
  activeTriggerElement: Element | null,
  activeTriggerId: string | null,
) {
  const ariaLabel = props['aria-label'];
  let ariaLabelledBy = props['aria-labelledby'];

  if (ariaLabelledBy == null && !ariaLabel) {
    // Prefer the live id of the element: the own `id` of an element from a `#render` slot wins over
    // the registered one.
    ariaLabelledBy = activeTriggerElement
      ? activeTriggerElement.id || undefined
      : activeTriggerId || undefined;
  }

  return ariaLabelledBy;
}
