/**
 * A press of the main button with pointer capture. The element of the listeners then gets each
 * move and the end of the pointer, anywhere (`test/measurements/pointer-press.test.ts`). One press
 * runs at a time, and only its pointer moves it and ends it.
 */
export function usePointerPress<Press>(options: {
  /** Starts a press at a `pointerdown` of the main button. With no result, no press starts. */
  start: (event: PointerEvent) => Press | undefined;
  move: (press: Press, event: PointerEvent) => void;
  /**
   * Ends the press. `released` is `true` at the release of the button. A `pointercancel` and
   * `cancel()` end it with `false`, and `cancel()` gives no event.
   */
  end: (press: Press, event: PointerEvent | undefined, released: boolean) => void;
}) {
  let active: { pointerId: number; press: Press } | undefined;

  function finish(event: PointerEvent | undefined, released: boolean) {
    const ended = active;
    if (!ended) return;
    active = undefined;
    options.end(ended.press, event, released);
  }

  function endWith(released: boolean) {
    return (event: PointerEvent) => {
      if (event.pointerId === active?.pointerId) finish(event, released);
    };
  }

  return {
    isPressed: () => active !== undefined,
    /** Ends the press with no event. The browser ends the capture at the release. */
    cancel: () => finish(undefined, false),
    listeners: {
      onPointerdown(event: PointerEvent) {
        if (active || event.button !== 0) return;
        const press = options.start(event);
        if (press === undefined) return;
        active = { pointerId: event.pointerId, press };
        (event.currentTarget as Element).setPointerCapture(event.pointerId);
      },
      onPointermove(event: PointerEvent) {
        if (event.pointerId !== active?.pointerId) return;
        // Firefox gives the page no `pointerup` for a release outside its view. The next move has
        // no button down.
        if (event.buttons === 0) finish(event, true);
        else options.move(active.press, event);
      },
      onPointerup: endWith(true),
      onPointercancel: endWith(false),
    },
  };
}
