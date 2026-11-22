import { inject, type InjectionKey } from 'vue';
import { createError } from '../common/createError';
import type { PickerForPart } from '../common/picker/root';
import type { TimeClockHourCycle } from '../time-clock/views';
import type { TimePickerRootProps, TimePickerRootValue } from './types';

/** What `TimePicker.Root` gives to its parts. The properties are reactive. */
export interface TimePickerForPart extends PickerForPart<TimePickerRootValue> {
  readonly props: Readonly<TimePickerRootProps<TimePickerRootValue>>;
  readonly locale: Intl.LocalesArgument;
  /** The `hourCycle` prop, else the hour cycle of the locale. */
  readonly hourCycle: TimeClockHourCycle;
  /** The time that a column and the clock start from: of the value, else of `referenceDate`, else midnight. */
  readonly time: Temporal.PlainTime;
}

export const timePickerKey: InjectionKey<TimePickerForPart> = Symbol(
  process.env.NODE_ENV !== 'production' ? 'time picker' : undefined,
);

/** The root of the part. A part with no root throws an error that names it. */
export function injectTimePicker(part: string): TimePickerForPart {
  const picker = inject(timePickerKey, null);
  if (!picker) {
    throw createError(67, part);
  }
  return picker;
}
