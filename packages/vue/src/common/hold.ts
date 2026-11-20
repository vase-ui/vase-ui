import { onBeforeUnmount } from 'vue';
import { ownerWindow } from './owner';

const FIRST_REPEAT = 460;
const REPEAT = 60;

/**
 * The hold of a button that steps. A press of the main button steps, and a hold repeats the step
 * after 460 ms and then each 60 ms, until a step does nothing. The repeat pauses while the pointer
 * is out of the button. The hold ends at the release, at `pointercancel`, at `end()` and at the
 * unmount. A mouse steps at the press. A touch steps at its click, or at the first repeat when it
 * stays, because the browser cancels a touch that becomes a scroll before then. The click of a
 * press that stepped steps no more: `takeClick()` tells it.
 */
export function useHold<Press>(options: {
  /** Starts a hold at a press of the main button. With no result, no hold starts. */
  start: (event: PointerEvent, mouse: boolean) => Press | undefined;
  /** Steps one time. Returns `false` for a step that does nothing. */
  step: (press: Press) => boolean;
  /** The release of the button ends the hold. */
  release?: (press: Press, event: PointerEvent) => void;
}) {
  interface Hold {
    readonly window: Window;
    readonly pointerId: number;
    readonly press: Press;
    readonly mouse: boolean;
    stepped: boolean;
    /** The pointer is out of the button. */
    out: boolean;
    timer?: ReturnType<typeof setTimeout>;
  }
  let hold: Hold | undefined;
  let pressed = false;
  onBeforeUnmount(end);

  function act(current: Hold) {
    const stepped = options.step(current.press);
    current.stepped ||= stepped;
    return stepped;
  }

  function onPointerdown(event: PointerEvent) {
    if (event.button !== 0) return;
    const mouse = event.pointerType === 'mouse';
    const press = options.start(event, mouse);
    if (press === undefined) return;
    end();
    const current: Hold = {
      window: ownerWindow(event.currentTarget),
      pointerId: event.pointerId,
      press,
      mouse,
      stepped: false,
      out: false,
    };
    hold = current;
    const repeat = () => {
      if (current.out || act(current)) current.timer = setTimeout(repeat, REPEAT);
    };
    current.timer = setTimeout(repeat, FIRST_REPEAT);
    // An ancestor can stop `pointerup` before it gets to the button.
    current.window.addEventListener('pointerup', onRelease, true);
    current.window.addEventListener('pointercancel', onCancel, true);
    if (mouse && !act(current)) clearTimeout(current.timer);
  }

  function onRelease(event: PointerEvent) {
    const current = hold;
    if (event.pointerId !== current?.pointerId) return;
    end();
    // The click of a press comes before a timer that starts at its release.
    pressed = current.mouse || current.stepped;
    if (pressed) setTimeout(() => (pressed = false));
    options.release?.(current.press, event);
  }

  function onCancel(event: PointerEvent) {
    if (event.pointerId === hold?.pointerId) end();
  }

  function end() {
    if (!hold) return;
    clearTimeout(hold.timer);
    hold.window.removeEventListener('pointerup', onRelease, true);
    hold.window.removeEventListener('pointercancel', onCancel, true);
    hold = undefined;
  }

  return {
    listeners: {
      onPointerdown,
      onPointerleave: () => hold && (hold.out = true),
      onPointerenter: () => hold && (hold.out = false),
    },
    /** Ends the hold with no release. */
    end,
    /** The click is the click of a press that stepped. It steps no more. */
    takeClick() {
      const taken = pressed;
      pressed = false;
      return taken;
    },
  };
}
