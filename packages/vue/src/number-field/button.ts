import { computed, onBeforeUnmount, useAttrs, watch } from 'vue';
import { useButton } from '../button/button';
import { useElement } from '../common/element';
import { injectNumberFieldRoot, stateAttributes, type StepKeys } from './root';
import type { NumberFieldRootState } from './types';

const firstRepeat = 460;
const repeat = 60;

interface Hold {
  readonly pointerId: number;
  readonly start: number | null;
  readonly keys: StepKeys;
  readonly event: PointerEvent;
  readonly mouse: boolean;
  steps: number;
  /** The pointer is out of the button. */
  out: boolean;
  timer?: ReturnType<typeof setTimeout>;
}

/** The increment or the decrement button. */
export function useStepButton(
  direction: 1 | -1,
  props: { disabled: boolean },
  part: 'Increment' | 'Decrement',
) {
  const root = injectNumberFieldRoot(part);
  const reason = direction > 0 ? 'increment-press' : 'decrement-press';
  const attrs = useAttrs();
  const { element, setElement } = useElement<HTMLElement>();
  const { disabled, mergeAttributes } = useButton({
    element,
    disabled: () =>
      props.disabled || root.state.disabled || root.state.readonly || root.atBound(direction),
    type: 'button',
  });
  const state = computed<NumberFieldRootState>(() => ({ ...root.state, disabled: disabled.value }));
  let hold: Hold | undefined;
  // The press stepped, so the click that follows its release does not step again.
  let pressed = false;

  // A hold ends with no commit when the field becomes disabled or read-only.
  watch(
    () => root.state.disabled || root.state.readonly,
    (off) => {
      if (!off) return;
      endHold();
      pressed = false;
    },
  );
  onBeforeUnmount(endHold);

  const ownProps = computed(() => ({
    // The text input is the one tab stop of the field.
    tabindex: -1,
    'aria-controls': root.inputId,
    style: { userSelect: 'none', WebkitUserSelect: 'none' },
    ...stateAttributes(state.value, ['disabled']),
    onPointerdown,
    onPointerleave: () => hold && (hold.out = true),
    onPointerenter: () => hold && (hold.out = false),
    onClick,
  }));

  function stepHeld(current: Hold) {
    if (root.step(direction, current.keys, reason, current.event) !== undefined) current.steps++;
  }

  function onPointerdown(event: PointerEvent) {
    if (event.button !== 0 || disabled.value) return;
    const mouse = event.pointerType === 'mouse';
    if (mouse) {
      // A press on a button takes the focus from the text input (measured). A touch opens no
      // software keyboard, so it does not move the focus.
      event.preventDefault();
      root.focusInput();
    }
    endHold();
    const current: Hold = {
      pointerId: event.pointerId,
      start: root.state.value,
      keys: { altKey: event.altKey, shiftKey: event.shiftKey },
      event,
      mouse,
      steps: 0,
      out: false,
    };
    hold = current;
    // A touch steps at its click, or at the first repeat when it stays. The browser cancels a
    // touch that becomes a scroll before then (measured).
    if (mouse) stepHeld(current);
    const next = () => {
      if (!current.out) stepHeld(current);
      // At its bound the button is disabled, and the repeat stops.
      if (!disabled.value) current.timer = setTimeout(next, repeat);
    };
    current.timer = setTimeout(next, firstRepeat);
    // An ancestor can stop `pointerup` before it gets to the button (measured).
    window.addEventListener('pointerup', onRelease, true);
    window.addEventListener('pointercancel', onCancel, true);
  }

  function onRelease(event: PointerEvent) {
    const current = hold;
    if (!current || event.pointerId !== current.pointerId) return;
    endHold();
    // A tap that did not step steps at its click. The click of a press comes before a timer that
    // starts at its release (measured).
    pressed = current.mouse || current.steps > 0;
    if (pressed) setTimeout(() => (pressed = false));
    const { value } = root.state;
    if (value !== current.start) root.commit(value, reason, event);
  }

  function onCancel(event: PointerEvent) {
    if (event.pointerId !== hold?.pointerId) return;
    endHold();
    pressed = false;
  }

  function endHold() {
    if (!hold) return;
    clearTimeout(hold.timer);
    hold = undefined;
    window.removeEventListener('pointerup', onRelease, true);
    window.removeEventListener('pointercancel', onCancel, true);
  }

  function onClick(event: MouseEvent) {
    if (pressed) {
      pressed = false;
      return;
    }
    const next = root.step(direction, event, reason, event);
    if (next !== undefined) root.commit(next, reason, event);
  }

  return {
    element,
    setElement,
    state,
    elementProps: () => mergeAttributes(ownProps.value, attrs),
  };
}
