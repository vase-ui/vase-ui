import { computed, useAttrs, watch } from 'vue';
import { useButton } from '../common/button';
import { useAsTag, useElement } from '../common/element';
import { useHold } from '../common/hold';
import { injectCalendar, stateAttributes } from './root';
import type { CalendarPreviousButtonProps, CalendarState } from './types';

const UNITS = { month: 'month', year: 'year', week: 'week', day: 'day' } as const;

/** `Calendar.PreviousButton` and `Calendar.NextButton`. */
export function useNavigationButton(props: CalendarPreviousButtonProps, direction: 1 | -1) {
  const calendar = injectCalendar();
  const attrs = useAttrs();
  const { element, setElement } = useElement<HTMLElement>();
  const ownDisabled = () => !!props.disabled || calendar.state.disabled;
  // At a limit the button keeps its focus and its place in the tab order, so a hold that reaches
  // the limit does not lose the focus.
  const button = useButton({
    element,
    disabled: () => ownDisabled() || !calendar.canMove(direction),
    focusableWhenDisabled: () => !ownDisabled(),
    type: 'button',
    tag: useAsTag(() => props.as, 'button'),
  });
  // The hold reads the limit itself: `useButton` stops the click of a button at a limit, and not
  // its `pointerdown`.
  const step = (event: Event) => !ownDisabled() && calendar.move(direction, event);
  const hold = useHold<PointerEvent>({
    start: (event) => (!ownDisabled() && calendar.canMove(direction) ? event : undefined),
    step,
  });
  // `step` refuses only while the button or the calendar is disabled. When it is enabled again
  // before the release, the hold must not continue, and the click of its press must move nothing.
  watch(ownDisabled, (disabled) => {
    if (disabled) hold.cancel();
  });
  const state = computed<CalendarState>(() => ({
    ...calendar.state,
    disabled: button.disabled.value,
  }));
  const label = computed(() => {
    const { unit, count } = calendar.step;
    return new Intl.RelativeTimeFormat(calendar.locale, { numeric: 'auto' }).format(
      direction * count,
      UNITS[unit],
    );
  });

  return {
    element,
    setElement,
    state,
    elementProps: () =>
      button.mergeAttributes(
        {
          'aria-label': label.value,
          ...stateAttributes(state.value, ['disabled']),
          ...hold.listeners,
          onClick: (event: MouseEvent) => {
            if (!hold.takeClick()) step(event);
          },
        },
        attrs,
      ),
  };
}
