import { computed, watch } from 'vue';
import type { ComputedRef } from 'vue';
import { useIsHydrating } from '../../common/hydration';
import { formatText } from '../../internals/date-time/calendar/formatText';
import type { CalendarCellState } from '../../internals/date-time/calendar/viewPages';
import { isSameDay } from '../../internals/date-time/temporal';
import type { NativeButtonProps, VaseUIComponentProps } from '../../internals/types';
import { useButton } from '../../internals/use-button';
import { useRenderElement } from '../../internals/useRenderElement';
import { useCalendarRootContext } from '../root/CalendarRootContext';
import { useCalendarViewGridContext } from './CalendarViewGridContext';

interface UseCalendarCellParameters {
  props: VaseUIComponentProps<CalendarCellState> & NativeButtonProps;
  /** The month of the cell, or the first month of its year. */
  cell: () => Temporal.PlainYearMonth;
  state: ComputedRef<CalendarCellState>;
  /** The options of `Intl.DateTimeFormat` for the text of the cell. */
  format: () => Intl.DateTimeFormatOptions;
  /** The name of the cell. The text is the name when it is `undefined`. */
  label: () => string | undefined;
  press: (event: MouseEvent) => void;
}

/**
 * Shared implementation of `Calendar.MonthCell` and `Calendar.YearCell`. They differ in what they
 * show and in what a press does. The root gives the tab stop, the focus and the keys of a cell by
 * the first day of its month.
 */
export function useCalendarCell({
  props,
  cell,
  state,
  format,
  label,
  press,
}: UseCalendarCellParameters) {
  const root = useCalendarRootContext();
  const { columns } = useCalendarViewGridContext();
  const isHydrating = useIsHydrating();

  const date = computed(() => cell().toPlainDate({ day: 1 }));
  const isTabStop = computed(
    () => root.tabStop.value !== null && isSameDay(root.tabStop.value, date.value),
  );
  const text = computed(() => formatText(cell(), format(), root.locale.value));

  const { getButtonProps, buttonRef } = useButton({
    disabled: () => state.value.disabled,
    native: () => props.nativeButton,
  });

  const { element, elementProps, setRef, usesRenderSlot } = useRenderElement('button', props, {
    state,
    ref: buttonRef,
    props: (attrs) => {
      const tabindex = isTabStop.value ? 0 : -1;
      return [
        {
          role: 'gridcell',
          'aria-label': label(),
          'aria-selected': state.value.selected,
          'aria-current': state.value.current ? 'date' : undefined,
          ...(state.value.disabled && { 'aria-disabled': true }),
          // The first client render can put the tab stop on another cell than the server HTML: the
          // `Intl` data of the engine can give another calendar, and a root with no day of the
          // server in the server HTML reads the clock of the browser. The text also comes from the
          // data of `Intl` in the engine. Hydration does not patch an attribute, so the string
          // differs from the number that the button gives after the mount, and Vue then writes the
          // attribute again.
          tabindex: isHydrating.value ? String(tabindex) : tabindex,
          'data-allow-mismatch': isHydrating.value ? 'attribute,text' : undefined,
          onClick: press,
          onFocusin: (event: FocusEvent) => {
            root.onCellFocus(cell(), event);
          },
          onKeydown: (event: KeyboardEvent) => {
            root.onCellKeydown(cell(), columns.value, event);
          },
        },
        attrs,
        getButtonProps,
      ];
    },
  });

  // The root focuses a cell after a key moves the focus, and it finds the button of the cell here.
  watch(
    [element, date],
    ([button, day], _previous, onCleanup) => {
      if (button) {
        onCleanup(root.registerDay(day, button));
      }
    },
    { flush: 'post' },
  );

  return { element, elementProps, setRef, usesRenderSlot, text };
}
