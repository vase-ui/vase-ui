import { inject } from 'vue';
import type { InjectionKey } from 'vue';
import type { DateTimePickerContext } from '../../internals/date-time/picker/useDateTimePickerRoot';
import type {
  DatePickerRootChangeEventDetails,
  DatePickerRootProps,
  DatePickerRootValue,
} from './DatePickerRoot.vue';
import type { DateTimeFieldGranularity } from '../../internals/date-time/field/useDateTimeFieldRoot';
import { isKind, today, yearMonthInCalendar } from '../../internals/date-time/temporal';
import type { DateValue } from '../../internals/date-time/temporal';

export interface DatePickerRootContext extends DateTimePickerContext<
  DatePickerRootValue | null,
  DatePickerRootValue,
  DatePickerRootChangeEventDetails
> {
  /** The props of the root. Its parts read the props that they share. */
  props: Readonly<DatePickerRootProps>;
}

export const DatePickerRootContext: InjectionKey<DatePickerRootContext> = Symbol();

export function useDatePickerRootContext(): DatePickerRootContext {
  const context = inject(DatePickerRootContext, undefined);
  if (context === undefined) {
    throw new Error(
      'Vase UI: A part of Date Picker must be inside <DatePicker.Root>. Without a root the part has no value and no popup to share. Put the part inside <DatePicker.Root>.',
    );
  }

  return context;
}

export function createPickerTemplate(
  granularity: DateTimeFieldGranularity | undefined,
  calendar: string | undefined,
  timeZone: string | undefined,
): DateValue | Temporal.PlainYearMonth {
  const date = today(timeZone);
  if (granularity === 'month') {
    const isoMonth = date.toPlainYearMonth();
    return calendar === undefined || yearMonthInCalendar(isoMonth, calendar)
      ? isoMonth
      : date.withCalendar(calendar).toPlainYearMonth();
  }
  return granularity === undefined || granularity === 'day' ? date : date.toPlainDateTime();
}

export function hasTime(
  value: DatePickerRootValue | null,
): value is Temporal.PlainDateTime | Temporal.ZonedDateTime {
  return isKind(value, 'dateTime') || isKind(value, 'zonedDateTime');
}
