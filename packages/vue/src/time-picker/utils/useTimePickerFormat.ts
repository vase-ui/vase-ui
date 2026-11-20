import { computed } from 'vue';
import type { ComputedRef } from 'vue';
import { hourCycleOf } from '../../internals/date-time/format';
import type { TimeClockHourCycle } from '../../time-clock/views';
import { useFormatLocale } from '../../utils/useFormatLocale';
import type { TimePickerRootContext } from '../root/TimePickerRootContext';

export interface TimePickerFormat {
  /** The locale for the texts of a part. With no `locale` prop, it is `en-US` until the part is mounted. */
  locale: ComputedRef<Intl.LocalesArgument | undefined>;
  /** The hour cycle: the `hourCycle` prop of the picker, else the hour cycle of the locale. */
  hourCycle: ComputedRef<TimeClockHourCycle>;
}

/** The locale and the hour cycle that a part of the popup of a time picker formats its text with. */
export function useTimePickerFormat(picker: TimePickerRootContext): TimePickerFormat {
  const locale = useFormatLocale(() => picker.props.locale);
  const hourCycle = computed(() => picker.props.hourCycle ?? hourCycleOf(locale.value));
  return { locale, hourCycle };
}

/** The `hourCycle` option of `Intl.DateTimeFormat` for an hour cycle that a consumer gave, or `undefined` for the cycle of the locale. */
export function hourCycleOption(
  hourCycle: TimeClockHourCycle | undefined,
): 'h12' | 'h23' | undefined {
  return hourCycle === undefined ? undefined : hourCycle === 12 ? 'h12' : 'h23';
}
