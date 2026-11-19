import { computed } from 'vue';
import type { HTMLAttributes, Ref } from 'vue';
import { useIsHydrating } from '../../common/hydration';
import type { DayState } from '../../internals/date-time/calendar/dayState';
import { formatText } from '../../internals/date-time/calendar/formatText';
import { isSameDay } from '../../internals/date-time/temporal';
import type { StateAttributesMapping } from '../../internals/getStateAttributesProps';
import type { NativeButtonProps, VaseUIComponentProps } from '../../internals/types';
import { useButton } from '../../internals/use-button/useButton';
import { useRenderElement } from '../../internals/useRenderElement';
import { useCalendarMonthContext } from '../month/CalendarMonthContext';
import { useCalendarRootContext } from '../root/CalendarRootContext';

const FULL_DATE: Intl.DateTimeFormatOptions = {
  weekday: 'long',
  year: 'numeric',
  month: 'long',
  day: 'numeric',
};

interface DayButtonProps<State> extends NativeButtonProps, VaseUIComponentProps<State> {
  format?: Intl.DateTimeFormatOptions | undefined;
}

interface UseDayButtonOptions<State extends DayState> {
  day: Readonly<Ref<Temporal.PlainDate>>;
  state: Readonly<Ref<State>>;
  stateAttributesMapping: StateAttributesMapping<State>;
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
  { day, state, stateAttributesMapping, extraProps, register }: UseDayButtonOptions<State>,
) {
  const root = useCalendarRootContext();
  const { isLeaving } = useCalendarMonthContext();
  const isHydrating = useIsHydrating();

  // The button of a month that leaves has no tab stop, and the root does not focus it.
  const isTabStop = computed(
    () =>
      !isLeaving.value && root.tabStop.value !== null && isSameDay(root.tabStop.value, day.value),
  );
  const text = computed(() => formatText(day.value, { day: 'numeric' }, root.locale.value));
  const label = computed(() => formatText(day.value, props.format ?? FULL_DATE, root.locale.value));

  const rendered = useRenderElement('button', props, {
    button: (element) =>
      useButton(element, {
        disabled: () => state.value.disabled,
        native: () => props.nativeButton,
      }),
    state,
    props: (attrs) => {
      const tabindex = isTabStop.value ? 0 : -1;
      return [
        {
          'aria-label': label.value,
          'aria-current': state.value.today ? 'date' : undefined,
          // The button of a disabled day gets `disabled` or `aria-disabled` from `useButton`. A key
          // with the value `undefined` here would replace that attribute.
          ...(state.value.unavailable && { 'aria-disabled': true }),
          // The first client render can put the tab stop on another day than the server HTML: the
          // `Intl` data of the engine can give another first day of the week or calendar, and a root
          // with no day of the server in the server HTML reads the clock of the browser. The day text
          // also comes from the data of `Intl` in the engine. Vue keeps the server `tabindex` from
          // a `v-bind` object while it hydrates. The change from a string to a number makes Vue
          // write it after the mount.
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
      ];
    },
    stateAttributesMapping,
  });

  root.useFocusTarget(rendered.element, () => (isLeaving.value ? null : day.value), register);

  return { ...rendered, text };
}
