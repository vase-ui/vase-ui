import { computed, inject, useAttrs, watch, type ComputedRef, type InjectionKey } from 'vue';
import { useButton } from '../common/button';
import { createError } from '../common/createError';
import { useAsTag, useElement } from '../common/element';
import { formatText } from '../common/date-time/text';
import { isSameDay } from '../common/date-time/temporal';
import { injectCalendar } from './root';
import type { CalendarCellState } from './types';

/** What `Calendar.MonthGrid` and `Calendar.YearGrid` give to their cells. The properties are reactive. */
export interface GridForCell {
  /** The cells of a row. Up and down move the focus by a row. */
  readonly columns: number;
}

export const gridKey: InjectionKey<GridForCell> = Symbol(
  process.env.NODE_ENV !== 'production' ? 'calendar cell grid' : undefined,
);

/** `Calendar.MonthCell` and `Calendar.YearCell`. */
export function useCell(
  props: { as?: unknown },
  options: {
    unit: 'month' | 'year';
    cell: () => Temporal.PlainYearMonth;
    format: () => Intl.DateTimeFormatOptions;
    /** The name of the cell, when its text is not enough. */
    label?: () => string;
  },
) {
  const calendar = injectCalendar();
  const grid = inject(gridKey, null);
  if (!grid) {
    throw createError(4);
  }
  const attrs = useAttrs();
  const { element, setElement } = useElement<HTMLElement>();
  const date = computed(() => options.cell().toPlainDate({ day: 1 }));
  const state: ComputedRef<CalendarCellState> = computed(() =>
    calendar.cellState(options.cell(), options.unit),
  );
  const button = useButton({
    element,
    disabled: () => state.value.disabled,
    type: 'button',
    tag: useAsTag(() => props.as, 'button'),
  });
  const text = computed(() => formatText(options.cell(), options.format(), calendar.locale));

  watch(
    [element, date],
    ([target, day], _, onCleanup) => {
      if (!target) return;
      onCleanup(
        calendar.addTarget({
          date: day,
          element: target,
          get columns() {
            return grid.columns;
          },
        }),
      );
    },
    { flush: 'post', immediate: true },
  );

  return {
    element,
    setElement,
    state,
    text,
    elementProps: () =>
      button.mergeAttributes(
        {
          role: 'gridcell',
          'aria-label': options.label?.(),
          'aria-selected': state.value.selected ? 'true' : 'false',
          'aria-current': state.value.current ? 'date' : undefined,
          tabindex: calendar.tabStop && isSameDay(calendar.tabStop, date.value) ? 0 : -1,
          onClick: (event: MouseEvent) => calendar.pressCell(options.cell(), options.unit, event),
        },
        attrs,
      ),
  };
}
