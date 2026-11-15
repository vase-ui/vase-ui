import { computed, shallowRef } from 'vue';
import type { VaseUIComponentProps } from '../../internals/types';
import { useButton } from '../../internals/use-button';
import { usePressAndHold } from '../../internals/usePressAndHold';
import { useRenderElement } from '../../internals/useRenderElement';
import type { CalendarState } from '../root/CalendarRoot.vue';
import { useCalendarRootContext } from '../root/CalendarRootContext';

interface NavigationButtonProps extends VaseUIComponentProps<CalendarState> {
  disabled: boolean;
  nativeButton: boolean;
}

/**
 * Shared implementation of the buttons that move the pages. They differ in the direction only.
 * A press moves one step, and a hold repeats the step until a limit.
 */
export function useCalendarNavigationButton(props: NavigationButtonProps, step: 1 | -1) {
  const root = useCalendarRootContext();

  const isDisabled = computed(() => props.disabled || root.state.value.disabled);
  const isAtLimit = computed(() => !(step === 1 ? root.canNext : root.canPrevious).value);
  const isUnavailable = computed(() => isDisabled.value || isAtLimit.value);
  const state = computed<CalendarState>(() => ({
    ...root.state.value,
    disabled: isUnavailable.value,
  }));
  const label = computed(() => {
    const { unit, count } = root.navigationStep.value;
    const noun = unit.slice(0, -1);
    return `${step === 1 ? 'Next' : 'Previous'} ${count === 1 ? noun : `${count} ${unit}`}`;
  });

  const buttonElement = shallowRef<HTMLElement | null>(null);

  const { pointerHandlers, shouldSkipClick } = usePressAndHold({
    disabled: isUnavailable,
    elementRef: buttonElement,
    tick: (event) => root.navigate(step, event),
  });

  function onClick(event: MouseEvent) {
    if (!event.defaultPrevented && !isUnavailable.value && !shouldSkipClick(event)) {
      root.navigate(step, event);
    }
  }

  const { getButtonProps, buttonRef } = useButton({
    disabled: isUnavailable,
    native: () => props.nativeButton,
    // A button at a limit keeps its focus and says that it is unavailable. A hold that reaches the
    // limit then does not lose the focus. A disabled button leaves the tab order.
    focusableWhenDisabled: () => !isDisabled.value,
  });

  const { element, elementProps } = useRenderElement('button', props, {
    ref: [
      buttonRef,
      (value) => {
        buttonElement.value = value;
      },
    ],
    state,
    props: (attrs) => [
      { 'aria-label': label.value, ...pointerHandlers, onClick },
      attrs,
      getButtonProps,
    ],
  });

  return { element, elementProps, state };
}
