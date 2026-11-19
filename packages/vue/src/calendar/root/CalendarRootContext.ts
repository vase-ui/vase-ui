import { inject, computed, provide, shallowRef } from 'vue';
import type { ComputedRef, InjectionKey, Ref } from 'vue';
import type { CalendarRootController } from '../../internals/date-time/calendar/useCalendarRoot';
import type { CalendarState, CalendarRootState } from './CalendarRoot.vue';
import type { DayState } from '../../internals/date-time/calendar/dayState';
import { getModifierAttributes } from '../../internals/date-time/calendar/dayState';
import type { StateAttributesMapping } from '../../internals/getStateAttributesProps';
import { getPageKey } from '../../internals/date-time/calendar/monthGrid';
import type { CalendarPage } from '../../internals/date-time/calendar/monthGrid';
import { useCalendarMonthContext } from '../month/CalendarMonthContext';
import type { VaseUIComponentProps } from '../../internals/types';
import { useButton } from '../../internals/use-button/useButton';
import { usePressAndHold } from '../../internals/usePressAndHold';
import { useRenderElement } from '../../internals/useRenderElement';
import * as CalendarDayDataAttributes from '../day/CalendarDayDataAttributes';
import * as CalendarRootDataAttributes from './CalendarRootDataAttributes';

export interface CalendarRootContext extends Omit<
  CalendarRootController,
  'focus' | 'hydrationAttributes'
> {
  state: ComputedRef<CalendarState>;
}

export const CalendarRootContext: InjectionKey<CalendarRootContext> = Symbol();

export function useCalendarRootContext(): CalendarRootContext {
  const context = inject(CalendarRootContext, undefined);
  if (context === undefined) {
    throw new Error(
      'Vase UI: A part of Calendar must be inside <Calendar.Root>. Without a root the part has no days and no selection to show. Put the part inside <Calendar.Root>.',
    );
  }

  return context;
}

export interface CalendarDayContext {
  day: Readonly<Ref<Temporal.PlainDate>>;
  state: ComputedRef<DayState>;
}

export const CalendarDayContext: InjectionKey<CalendarDayContext> = Symbol();

export function useCalendarDayContext(): CalendarDayContext {
  const context = inject(CalendarDayContext, undefined);
  if (context === undefined) {
    throw new Error(
      'Vase UI: <Calendar.DayButton> must be inside <Calendar.Day>. Without a day the button has no date to select. Put the button inside <Calendar.Day>.',
    );
  }

  return context;
}

export const dayStateAttributesMapping: StateAttributesMapping<DayState> = {
  // The default mapping writes `data-outsidemonth`.
  outsideMonth: (value) => (value ? { [CalendarDayDataAttributes.outsideMonth]: '' } : null),
  modifiers: (value) => getModifierAttributes(value),
};

// The default mapping writes `data-multiplemonths` and `data-navigationdirection`.
export const calendarRootStateAttributesMapping: StateAttributesMapping<CalendarRootState> = {
  multipleMonths: (value) => (value ? { [CalendarRootDataAttributes.multipleMonths]: '' } : null),
  navigationDirection: (value) => ({ [CalendarRootDataAttributes.navigationDirection]: value }),
  broadcastCalendar: (value) =>
    value ? { [CalendarRootDataAttributes.broadcastCalendar]: '' } : null,
};

export interface CalendarSelectOption {
  value: string;
  text: string;
  disabled: boolean;
}

/** What `Calendar.MonthSelect` and `Calendar.YearSelect` give to the options that they render. */
export interface CalendarSelectContext {
  options: ComputedRef<CalendarSelectOption[]>;
  /** The `value` of the option that the select shows. */
  selected: ComputedRef<string>;
}

export const CalendarSelectContext: InjectionKey<CalendarSelectContext> = Symbol();

interface UseCalendarSelectParameters {
  root: CalendarRootContext;
  /** Gives the element of the select. The part makes it after this call. */
  getSelect: () => HTMLSelectElement | null;
  /** The options of the select for a page. */
  getOptions: (page: CalendarPage) => CalendarSelectOption[];
  /** The `value` of the option that a page shows. */
  getValue: (page: CalendarPage) => string;
  /** The month that an option of the select means for a page. */
  getMonth: (page: CalendarPage, value: string) => Temporal.PlainYearMonth;
}

/**
 * Shared implementation of the two selects. A select inside `Calendar.Month` is for the page of
 * that month. Outside a month, it is for the first page.
 */
export function useCalendarSelect({
  root,
  getSelect,
  getOptions,
  getValue,
  getMonth,
}: UseCalendarSelectParameters) {
  const monthContext = useCalendarMonthContext(true);

  const page = computed(() => monthContext?.month.value ?? root.pages.value[0]);
  const options = computed(() => (page.value ? getOptions(page.value) : []));
  const selected = computed(() => (page.value ? getValue(page.value) : ''));
  provide(CalendarSelectContext, { options, selected });

  return (event: Event) => {
    const select = getSelect();
    const current = page.value;
    if (!select || !current) {
      return;
    }
    const key = getPageKey(current);
    const index = root.pages.value.findIndex((other) => getPageKey(other) === key);
    root.showMonth(getMonth(current, select.value), Math.max(0, index), event);
    // The root decides the month. A listener can cancel the change, and a controlled month waits
    // for its value, so the select shows the month of the root again.
    select.value = selected.value;
  };
}

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
  const canNavigate = step === 1 ? root.canNext : root.canPrevious;
  const isUnavailable = computed(() => isDisabled.value || !canNavigate.value);
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

  const rendered = useRenderElement('button', props, {
    elementRef: buttonElement,
    button: (element) =>
      useButton(element, {
        disabled: isUnavailable,
        native: () => props.nativeButton,
        // A button at a limit keeps its focus and says that it is unavailable. A hold that reaches the
        // limit then does not lose the focus. A disabled button leaves the tab order.
        focusableWhenDisabled: () => !isDisabled.value,
      }),
    state,
    props: (attrs) => [{ 'aria-label': label.value, ...pointerHandlers, onClick }, attrs],
  });

  return { ...rendered, state };
}
