/// <reference lib="esnext.temporal" preserve="true" />
export * as RangeCalendar from './index.parts';

export { default as RangeCalendarRoot } from './root/RangeCalendarRoot.vue';
export { default as RangeCalendarDay } from './day/RangeCalendarDay.vue';
export { default as RangeCalendarDayButton } from './day-button/RangeCalendarDayButton.vue';
export { default as RangeCalendarMonths } from '../calendar/months/CalendarMonths.vue';
export { default as RangeCalendarMonth } from '../calendar/month/CalendarMonth.vue';
export { default as RangeCalendarGrid } from '../calendar/grid/CalendarGrid.vue';
export { default as RangeCalendarGridHeader } from '../calendar/grid-header/CalendarGridHeader.vue';
export { default as RangeCalendarGridHeaderRow } from '../calendar/grid-header-row/CalendarGridHeaderRow.vue';
export { default as RangeCalendarWeekday } from '../calendar/weekday/CalendarWeekday.vue';
export { default as RangeCalendarGridBody } from '../calendar/grid-body/CalendarGridBody.vue';
export { default as RangeCalendarWeek } from '../calendar/week/CalendarWeek.vue';
export { default as RangeCalendarCaption } from '../calendar/caption/CalendarCaption.vue';
export { default as RangeCalendarMonthSelect } from '../calendar/month-select/CalendarMonthSelect.vue';
export { default as RangeCalendarYearSelect } from '../calendar/year-select/CalendarYearSelect.vue';
export { default as RangeCalendarPreviousButton } from '../calendar/previous-button/CalendarPreviousButton.vue';
export { default as RangeCalendarNextButton } from '../calendar/next-button/CalendarNextButton.vue';
export { default as RangeCalendarWeekNumberHeader } from '../calendar/week-number-header/CalendarWeekNumberHeader.vue';
export { default as RangeCalendarWeekNumber } from '../calendar/week-number/CalendarWeekNumber.vue';
export { default as RangeCalendarFooter } from '../calendar/footer/CalendarFooter.vue';

export type * from './root/RangeCalendarRoot.vue';
export type * from './day/RangeCalendarDay.vue';
export type * from './day-button/RangeCalendarDayButton.vue';
export type {
  CalendarMonthsProps as RangeCalendarMonthsProps,
  CalendarMonthsState as RangeCalendarMonthsState,
} from '../calendar/months/CalendarMonths.vue';
export type {
  CalendarMonthProps as RangeCalendarMonthProps,
  CalendarMonthState as RangeCalendarMonthState,
} from '../calendar/month/CalendarMonth.vue';
export type {
  CalendarGridProps as RangeCalendarGridProps,
  CalendarGridState as RangeCalendarGridState,
} from '../calendar/grid/CalendarGrid.vue';
export type {
  CalendarGridHeaderProps as RangeCalendarGridHeaderProps,
  CalendarGridHeaderState as RangeCalendarGridHeaderState,
} from '../calendar/grid-header/CalendarGridHeader.vue';
export type {
  CalendarGridHeaderRowProps as RangeCalendarGridHeaderRowProps,
  CalendarGridHeaderRowState as RangeCalendarGridHeaderRowState,
} from '../calendar/grid-header-row/CalendarGridHeaderRow.vue';
export type {
  CalendarWeekdayProps as RangeCalendarWeekdayProps,
  CalendarWeekdayState as RangeCalendarWeekdayState,
} from '../calendar/weekday/CalendarWeekday.vue';
export type {
  CalendarGridBodyProps as RangeCalendarGridBodyProps,
  CalendarGridBodyState as RangeCalendarGridBodyState,
} from '../calendar/grid-body/CalendarGridBody.vue';
export type {
  CalendarWeekProps as RangeCalendarWeekProps,
  CalendarWeekState as RangeCalendarWeekState,
} from '../calendar/week/CalendarWeek.vue';
export type {
  CalendarCaptionProps as RangeCalendarCaptionProps,
  CalendarCaptionState as RangeCalendarCaptionState,
} from '../calendar/caption/CalendarCaption.vue';
export type {
  CalendarMonthSelectProps as RangeCalendarMonthSelectProps,
  CalendarMonthSelectState as RangeCalendarMonthSelectState,
} from '../calendar/month-select/CalendarMonthSelect.vue';
export type {
  CalendarYearSelectProps as RangeCalendarYearSelectProps,
  CalendarYearSelectState as RangeCalendarYearSelectState,
} from '../calendar/year-select/CalendarYearSelect.vue';
export type {
  CalendarPreviousButtonProps as RangeCalendarPreviousButtonProps,
  CalendarPreviousButtonState as RangeCalendarPreviousButtonState,
} from '../calendar/previous-button/CalendarPreviousButton.vue';
export type {
  CalendarNextButtonProps as RangeCalendarNextButtonProps,
  CalendarNextButtonState as RangeCalendarNextButtonState,
} from '../calendar/next-button/CalendarNextButton.vue';
export type {
  CalendarWeekNumberHeaderProps as RangeCalendarWeekNumberHeaderProps,
  CalendarWeekNumberHeaderState as RangeCalendarWeekNumberHeaderState,
} from '../calendar/week-number-header/CalendarWeekNumberHeader.vue';
export type {
  CalendarWeekNumberProps as RangeCalendarWeekNumberProps,
  CalendarWeekNumberState as RangeCalendarWeekNumberState,
} from '../calendar/week-number/CalendarWeekNumber.vue';
export type {
  CalendarFooterProps as RangeCalendarFooterProps,
  CalendarFooterState as RangeCalendarFooterState,
} from '../calendar/footer/CalendarFooter.vue';

export * as RangeCalendarRootDataAttributes from './root/RangeCalendarRootDataAttributes';
export * as RangeCalendarDayDataAttributes from './day/RangeCalendarDayDataAttributes';
export * as RangeCalendarDayButtonDataAttributes from './day-button/RangeCalendarDayButtonDataAttributes';
export * as RangeCalendarMonthsDataAttributes from '../calendar/months/CalendarMonthsDataAttributes';
export * as RangeCalendarMonthDataAttributes from '../calendar/month/CalendarMonthDataAttributes';
export * as RangeCalendarGridDataAttributes from '../calendar/grid/CalendarGridDataAttributes';
export * as RangeCalendarGridHeaderDataAttributes from '../calendar/grid-header/CalendarGridHeaderDataAttributes';
export * as RangeCalendarGridHeaderRowDataAttributes from '../calendar/grid-header-row/CalendarGridHeaderRowDataAttributes';
export * as RangeCalendarWeekdayDataAttributes from '../calendar/weekday/CalendarWeekdayDataAttributes';
export * as RangeCalendarGridBodyDataAttributes from '../calendar/grid-body/CalendarGridBodyDataAttributes';
export * as RangeCalendarWeekDataAttributes from '../calendar/week/CalendarWeekDataAttributes';
export * as RangeCalendarCaptionDataAttributes from '../calendar/caption/CalendarCaptionDataAttributes';
export * as RangeCalendarMonthSelectDataAttributes from '../calendar/month-select/CalendarMonthSelectDataAttributes';
export * as RangeCalendarYearSelectDataAttributes from '../calendar/year-select/CalendarYearSelectDataAttributes';
export * as RangeCalendarPreviousButtonDataAttributes from '../calendar/previous-button/CalendarPreviousButtonDataAttributes';
export * as RangeCalendarNextButtonDataAttributes from '../calendar/next-button/CalendarNextButtonDataAttributes';
export * as RangeCalendarWeekNumberHeaderDataAttributes from '../calendar/week-number-header/CalendarWeekNumberHeaderDataAttributes';
export * as RangeCalendarWeekNumberDataAttributes from '../calendar/week-number/CalendarWeekNumberDataAttributes';
export * as RangeCalendarFooterDataAttributes from '../calendar/footer/CalendarFooterDataAttributes';
