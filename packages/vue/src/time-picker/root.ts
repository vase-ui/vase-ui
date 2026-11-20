import { inject, type InjectionKey } from 'vue';
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

export const timePickerKey: InjectionKey<TimePickerForPart> = Symbol('time picker');

/** The root of the part. A part with no root throws an error that names it. */
export function injectTimePicker(part: string): TimePickerForPart {
  const picker = inject(timePickerKey, null);
  if (!picker) {
    throw new Error(
      `Vase UI: <TimePicker.${part}> must be inside <TimePicker.Root>. Without a root the part has no value and no popup. Put the part inside <TimePicker.Root>.`,
    );
  }
  return picker;
}
