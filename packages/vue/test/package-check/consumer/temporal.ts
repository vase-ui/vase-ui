import type { Calendar } from '@vase-ui/vue/calendar';
import type { DateField } from '@vase-ui/vue/date-field';
import type { DatePicker } from '@vase-ui/vue/date-picker';
import type { RangeCalendar } from '@vase-ui/vue/range-calendar';
import type { TemporalPart } from '@vase-ui/vue/temporal-part';
import type { TemporalReexport } from '@vase-ui/vue/temporal-reexport';
import type { TimeClock } from '@vase-ui/vue/time-clock';
import type { TimeField } from '@vase-ui/vue/time-field';

declare const day: Temporal.PlainDate;
declare const time: Temporal.PlainTime;

export const calendarProps: Calendar.Root.Props = { value: day };
export const dateFieldProps: DateField.Root.Props = { value: day };
export const datePickerProps: DatePicker.Root.Props = { value: day };
export const rangeCalendarProps: RangeCalendar.Root.Props = { value: [day, null] };
export const temporalPartProps: TemporalPart.Props = { value: day };
export const temporalReexportProps: TemporalReexport.Props = { value: day };
export const timeClockProps: TimeClock.Root.Props = { defaultValue: time };

export const timeFieldProps: TimeField.Root.Props = { value: time };
