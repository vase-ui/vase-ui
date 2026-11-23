import { computed, useAttrs, watch } from 'vue';
import { useButton } from '../common/button';
import { useAsTag, useElement } from '../common/element';
import { useHold } from '../common/hold';
import { injectNumberFieldRoot, stateAttributes, type StepKeys } from './root';
import type { NumberFieldIncrementProps, NumberFieldRootState } from './types';

/** A press of a step button: the value at its start, and its keys. */
interface StepPress {
  readonly start: number | null;
  readonly keys: StepKeys;
  readonly event: PointerEvent;
}

/** The increment or the decrement button. */
export function useStepButton(
  direction: 1 | -1,
  props: { disabled: boolean; as?: NumberFieldIncrementProps['as'] },
  part: 'Increment' | 'Decrement',
) {
  const root = injectNumberFieldRoot(part);
  const reason = direction > 0 ? 'increment-press' : 'decrement-press';
  const attrs = useAttrs();
  const { element, setElement } = useElement<HTMLElement>();
  const button = useButton({
    element,
    disabled: () =>
      props.disabled || root.state.disabled || root.state.readonly || root.atBound(direction),
    type: 'button',
    tag: useAsTag(() => props.as, 'button'),
  });
  const { disabled } = button;
  const state = computed<NumberFieldRootState>(() => ({ ...root.state, disabled: disabled.value }));
  const hold = useHold<StepPress>({
    start(event, mouse) {
      if (disabled.value) return undefined;
      if (mouse) {
        // A press on a button takes the focus from the text input (measured). A touch opens no
        // software keyboard, so it does not move the focus.
        event.preventDefault();
        root.focusInput();
      }
      return {
        start: root.state.value,
        keys: { altKey: event.altKey, shiftKey: event.shiftKey },
        event,
      };
    },
    step: (press) => root.step(direction, press.keys, reason, press.event) !== undefined,
    release(press, event) {
      const { value } = root.state;
      if (value !== press.start) root.commit(value, reason, event);
    },
  });

  // A hold ends with no commit when the field becomes disabled or read-only.
  watch(
    () => root.state.disabled || root.state.readonly,
    (off) => {
      if (off) hold.cancel();
    },
  );

  const ownProps = computed(() => ({
    // The text input is the one tab stop of the field.
    tabindex: -1,
    'aria-controls': root.inputId,
    style: { userSelect: 'none', '-webkit-user-select': 'none' },
    ...stateAttributes(state.value, ['disabled']),
    ...hold.listeners,
    onClick,
  }));

  function onClick(event: MouseEvent) {
    if (hold.takeClick()) return;
    const next = root.step(direction, event, reason, event);
    if (next !== undefined) root.commit(next, reason, event);
  }

  return {
    element,
    setElement,
    state,
    elementProps: () => button.mergeAttributes(ownProps.value, attrs),
  };
}
