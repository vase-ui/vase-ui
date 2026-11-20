import { computed, onBeforeUnmount, useAttrs, useSlots } from 'vue';
import { useButton } from '../common/button';
import { useElement } from '../common/element';
import { injectCalendar, stateAttributes } from './root';
import type { CalendarPreviousButtonProps, CalendarState } from './types';

const FIRST_REPEAT = 460;
const REPEAT = 60;

interface Hold {
  readonly pointerId: number;
  readonly window: Window;
  /** The pointer is out of the button. */
  out: boolean;
  /** The hold made a step. */
  stepped: boolean;
  timer?: ReturnType<typeof setTimeout>;
}

/**
 * The hold of a button: a press with the main button steps, and a hold repeats the step after
 * 460 ms and then each 60 ms. The repeat pauses while the pointer is out of the button. The hold
 * ends at the release, at `pointercancel` and at the unmount. A mouse steps at the press, and a
 * touch at its click or at the first repeat. A press that stepped gives a click that does not step
 * again. `step` returns `false` when the hold cannot go on.
 */
function useHold(step: (event: Event) => boolean, canStart: () => boolean) {
  let hold: Hold | undefined;
  let skipClick = false;
  onBeforeUnmount(end);

  function act(current: Hold, event: Event) {
    current.stepped = true;
    return step(event);
  }

  function onPointerdown(event: PointerEvent) {
    if (event.button !== 0 || !canStart()) return;
    end();
    const element = event.currentTarget as Element;
    const current: Hold = {
      pointerId: event.pointerId,
      window: element.ownerDocument.defaultView ?? window,
      out: false,
      stepped: false,
    };
    hold = current;
    const repeat = () => {
      if (current.out || act(current, event)) current.timer = setTimeout(repeat, REPEAT);
    };
    current.timer = setTimeout(repeat, FIRST_REPEAT);
    // An ancestor can stop `pointerup` before it reaches the button.
    current.window.addEventListener('pointerup', onRelease, true);
    current.window.addEventListener('pointercancel', onRelease, true);
    if (event.pointerType === 'mouse' && !act(current, event)) clearTimeout(current.timer);
  }

  function onRelease(event: PointerEvent) {
    const current = hold;
    if (event.pointerId !== current?.pointerId) return;
    end();
    // The click of the press comes before a timer that starts at the release.
    skipClick = current.stepped && event.type === 'pointerup';
    if (skipClick) setTimeout(() => (skipClick = false));
  }

  function end() {
    if (!hold) return;
    clearTimeout(hold.timer);
    hold.window.removeEventListener('pointerup', onRelease, true);
    hold.window.removeEventListener('pointercancel', onRelease, true);
    hold = undefined;
  }

  return {
    onPointerdown,
    onPointerleave: () => hold && (hold.out = true),
    onPointerenter: () => hold && (hold.out = false),
    onClick(event: MouseEvent) {
      if (skipClick) {
        skipClick = false;
        return;
      }
      step(event);
    },
  };
}

const UNITS = { month: 'month', year: 'year', week: 'week', day: 'day' } as const;

/** `Calendar.PreviousButton` and `Calendar.NextButton`. */
export function useNavigationButton(props: CalendarPreviousButtonProps, direction: 1 | -1) {
  const calendar = injectCalendar();
  const attrs = useAttrs();
  const slots = useSlots();
  const { element, setElement } = useElement<HTMLElement>();
  const ownDisabled = () => !!props.disabled || calendar.state.disabled;
  // At a limit the button keeps its focus and its place in the tab order, so a hold that reaches
  // the limit does not lose the focus.
  const button = useButton({
    element,
    disabled: () => ownDisabled() || !calendar.canMove(direction),
    focusableWhenDisabled: () => !ownDisabled(),
    type: 'button',
    tag: () => (typeof props.as === 'string' && !slots.element ? props.as : undefined),
  });
  const hold = useHold(
    (event) => !ownDisabled() && calendar.move(direction, event),
    () => !ownDisabled() && calendar.canMove(direction),
  );
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
        { 'aria-label': label.value, ...stateAttributes(state.value, ['disabled']), ...hold },
        attrs,
      ),
  };
}
