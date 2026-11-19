import { inject } from 'vue';
import type { ComputedRef, InjectionKey } from 'vue';
import type { PickerPartElements } from '../../internals/date-time/picker/usePickerPartElement';
import type { DateValue } from '../../internals/date-time/temporal';
import type {
  DateRangePickerRootChangeEventDetails,
  DateRangePickerRootProps,
} from './DateRangePickerRoot.vue';

/** The first day and the last day of the range that the picker holds. */
export type DateRangePickerRange = readonly [DateValue | null, DateValue | null];

export interface DateRangePickerRootContext {
  /** The range of the picker. An end is `null` while it has no value. */
  range: ComputedRef<DateRangePickerRange>;
  /**
   * The end that gives the kind, the calendar, the time and the time zone of a new end. It is the
   * first end that has a value. Else it is an end of the default value, else the last end that the
   * picker had. Else it is the end that the granularity and the reference date give. Each part that
   * makes an end gets it as its default value, so a new end has the same kind whichever part makes
   * it.
   */
  template: ComputedRef<DateValue>;
  /**
   * Applies a change that a part reports. The root emits `valueChange` with the details of the
   * part, so a `details.cancel()` of a listener also stops the change of the part. Then the root
   * emits `update:modelValue` and takes the range.
   */
  commit: (range: DateRangePickerRange, details: DateRangePickerRootChangeEventDetails) => void;
  /**
   * A native reset of the form. An uncontrolled picker goes back to its default value. The two
   * fields call it for one event, and the root handles the first call.
   */
  reset: (details: DateRangePickerRootChangeEventDetails) => void;
  /** Whether the second press or a drag in the calendar closes the popup. */
  closeOnSelect: ComputedRef<boolean>;
  /** The start fields give the root its native fieldset and the popup its start anchor. */
  startFields: PickerPartElements;
  /** The end fields give the popup its end anchor. */
  endFields: PickerPartElements;
  /** The hidden inputs of the end fields. A `Field` around the picker validates the first one. */
  endInputs: PickerPartElements;
  /** The triggers give the root its native fieldset when it has no start field. */
  triggers: PickerPartElements;
  /** The props of the root. Its parts read the props that they share. */
  props: Readonly<DateRangePickerRootProps>;
  /**
   * Whether the picker ignores user interaction: its `disabled` prop, or a disabled field or
   * fieldset around it.
   */
  disabled: ComputedRef<boolean>;
}

export const DateRangePickerRootContext: InjectionKey<DateRangePickerRootContext> = Symbol();

export function useDateRangePickerRootContext(): DateRangePickerRootContext {
  // With one argument, Vue shows a warning when there is no provider. The error below says more.
  const context = inject(DateRangePickerRootContext, undefined);
  if (context === undefined) {
    throw new Error(
      'Vase UI: A part of Date Range Picker must be inside <DateRangePicker.Root>. Without a root the part has no value and no popup to share. Put the part inside <DateRangePicker.Root>.',
    );
  }

  return context;
}
