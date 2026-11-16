import { computed, watch } from 'vue';
import type { HTMLAttributes, Ref } from 'vue';
import { useAriaAfterHydration, useIsHydrating } from '../../../common/hydration';
import type { StateAttributesMapping } from '../../getStateAttributesProps';
import type { NativeButtonProps, VaseUIComponentProps } from '../../types';
import { useButton } from '../../use-button';
import { useRenderElement } from '../../useRenderElement';
import { isSameDay } from '../temporal';
import type { DayState } from './dayState';
import { formatText } from './formatText';
import type { CalendarRootController } from './useCalendarRoot';

const FULL_DATE: Intl.DateTimeFormatOptions = {
  weekday: 'long',
  year: 'numeric',
  month: 'long',
  day: 'numeric',
};

export interface DayButtonProps<State> extends NativeButtonProps, VaseUIComponentProps<State> {
  format?: Intl.DateTimeFormatOptions | undefined;
}

export interface UseDayButtonOptions<State extends DayState> {
  /** The root that owns the focused day. The context of the root part gives it. */
  root: Pick<
    CalendarRootController,
    'locale' | 'tabStop' | 'pressDay' | 'onDayFocus' | 'onDayKeydown' | 'registerDay'
  >;
  day: Readonly<Ref<Temporal.PlainDate>>;
  state: Readonly<Ref<State>>;
  /** Whether the month of the button left the calendar and stays until its animations end. */
  isLeaving: Readonly<Ref<boolean>>;
  stateAttributesMapping: StateAttributesMapping<State>;
  /**
   * The attributes and listeners that the button adds. A listener of `onClick`, `onFocusin` or
   * `onKeydown` replaces the one of the button, which presses, focuses and moves the day through
   * `root`. The replacing listener then calls `root` itself.
   */
  extraProps?: HTMLAttributes | undefined;
  /** Gives the button and its day to a registry other than the root's. It returns the undo. */
  register?: ((button: HTMLElement, date: Temporal.PlainDate) => () => void) | undefined;
}

/**
 * Makes the element of a day button: its name, its tab stop, its keys and its registration with
 * the root. A part calls it in `setup`.
 */
export function useDayButton<State extends DayState>(
  props: DayButtonProps<State>,
  {
    root,
    day,
    state,
    isLeaving,
    stateAttributesMapping,
    extraProps,
    register,
  }: UseDayButtonOptions<State>,
) {
  const isHydrating = useIsHydrating();
  const ariaAfterHydration = useAriaAfterHydration();

  // The button of a month that leaves has no tab stop, and the root does not focus it.
  const isTabStop = computed(
    () =>
      !isLeaving.value && root.tabStop.value !== null && isSameDay(root.tabStop.value, day.value),
  );
  const text = computed(() => formatText(day.value, { day: 'numeric' }, root.locale.value));
  const label = computed(() => formatText(day.value, props.format ?? FULL_DATE, root.locale.value));

  const { getButtonProps, buttonRef } = useButton({
    disabled: () => state.value.disabled,
    native: () => props.nativeButton,
  });

  const { element, elementProps } = useRenderElement('button', props, {
    state,
    ref: buttonRef,
    props: (attrs) => {
      const tabindex = isTabStop.value ? 0 : -1;
      return [
        {
          'aria-label': ariaAfterHydration(label.value),
          'aria-current': state.value.today ? 'date' : undefined,
          // The button of a disabled day gets `disabled` or `aria-disabled` from `useButton`. A key
          // with the value `undefined` here would replace that attribute.
          ...(state.value.unavailable && { 'aria-disabled': true }),
          // The first client render can put the tab stop on another day than the server HTML: the
          // `Intl` data of the engine can give another first day of the week or calendar, and a root
          // with no day of the server in the server HTML reads the clock of the browser. The day text
          // also comes from the data of `Intl` in the engine. Hydration does not patch an attribute,
          // so the string differs from the number that the button gives after the mount, and Vue
          // then writes the attribute again.
          tabindex: isHydrating.value ? String(tabindex) : tabindex,
          'data-allow-mismatch': isHydrating.value ? 'attribute,text' : undefined,
          onClick: (event: MouseEvent) => {
            root.pressDay(day.value, event);
          },
          onFocusin: (event: FocusEvent) => {
            root.onDayFocus(day.value, event);
          },
          onKeydown: (event: KeyboardEvent) => {
            root.onDayKeydown(day.value, event);
          },
          ...extraProps,
        },
        attrs,
        getButtonProps,
      ];
    },
    stateAttributesMapping,
  });

  // The root focuses a day after a key moves the focus, and it finds the button of the day here.
  watch(
    [element, day, isLeaving],
    ([button, date, leaving], _previous, onCleanup) => {
      if (button && !leaving) {
        onCleanup(root.registerDay(date, button));
        if (register) {
          onCleanup(register(button, date));
        }
      }
    },
    { flush: 'post' },
  );

  return { element, elementProps, text };
}
