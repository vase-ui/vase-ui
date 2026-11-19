import { inject } from 'vue';
import type { ComputedRef, InjectionKey } from 'vue';
import type { DateTimePickerContext } from '../../internals/date-time/picker/useDateTimePickerRoot';
import type {
  TimePickerRootChangeEventDetails,
  TimePickerRootProps,
  TimePickerRootValue,
} from './TimePickerRoot.vue';

export interface TimePickerRootContext extends DateTimePickerContext<
  TimePickerRootValue | null,
  TimePickerRootValue,
  TimePickerRootChangeEventDetails
> {
  /** The props of the root. Its parts read the props that they share. */
  props: Readonly<TimePickerRootProps<TimePickerRootValue>>;
  /** Whether the user can see the time but not change it. */
  readOnly: ComputedRef<boolean>;
  /** The time of the reference date, or midnight when the picker has none. */
  referenceTime: ComputedRef<Temporal.PlainTime>;
  /**
   * The time that a part of the popup shows and changes: the time of the value, or the reference
   * time while the picker has no value.
   */
  time: ComputedRef<Temporal.PlainTime>;
}

export const TimePickerRootContext: InjectionKey<TimePickerRootContext> = Symbol();

export function useTimePickerRootContext(): TimePickerRootContext {
  // With one argument, Vue shows a warning when there is no provider. The error below says more.
  const context = inject(TimePickerRootContext, undefined);
  if (context === undefined) {
    throw new Error(
      'Vase UI: A part of Time Picker must be inside <TimePicker.Root>. Without a root the part has no value and no popup to share. Put the part inside <TimePicker.Root>.',
    );
  }

  return context;
}
