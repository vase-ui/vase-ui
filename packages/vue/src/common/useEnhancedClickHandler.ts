export type InteractionType = 'mouse' | 'touch' | 'pen' | 'keyboard' | '';

/**
 * Gives the type of the input that made a click: a pointer type, or `'keyboard'`. Safari and Firefox
 * give a `MouseEvent` to a click handler, and a `MouseEvent` has no pointer type. A `PointerEvent`
 * that a script or a test tool made can also have an empty pointer type. In both cases, the type is
 * the one that the last `pointerdown` had.
 *
 * Call it in `setup`. Bind `onClick` and `onPointerdown` on the element.
 *
 * @param handler The function that the events call. It gets the event and the type of the input.
 */
export function useEnhancedClickHandler(
  handler: (event: MouseEvent | PointerEvent, interactionType: InteractionType) => void,
) {
  let lastClickInteractionType: InteractionType = '';

  function handlePointerdown(event: PointerEvent) {
    if (event.defaultPrevented) {
      return;
    }

    lastClickInteractionType = event.pointerType as InteractionType;
    handler(event, event.pointerType as InteractionType);
  }

  function handleClick(event: MouseEvent | PointerEvent) {
    // `event.detail` has the number of clicks on the element. 0 means that the keyboard made the
    // click.
    if (event.detail === 0) {
      handler(event, 'keyboard');
      return;
    }

    // Chrome and Edge give a `PointerEvent`.
    const pointerType = 'pointerType' in event ? (event.pointerType as InteractionType) : '';
    handler(event, pointerType || lastClickInteractionType);
    lastClickInteractionType = '';
  }

  return { onClick: handleClick, onPointerdown: handlePointerdown };
}
