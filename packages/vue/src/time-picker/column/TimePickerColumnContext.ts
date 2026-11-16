import { inject } from 'vue';
import type { ComputedRef, InjectionKey } from 'vue';
import type { TimePickerColumnUnit, TimePickerColumnValue } from '../utils/columns';

export interface TimePickerColumnContext {
  /** The unit that the column sets. */
  unit: ComputedRef<TimePickerColumnUnit>;
  /** The value that the time of the picker has in the column, or `null` while the picker has no value. */
  selectedValue: ComputedRef<TimePickerColumnValue | null>;
  /** Whether a selection in the column closes the popup. */
  closeOnSelect: ComputedRef<boolean>;
}

export const TimePickerColumnContext: InjectionKey<TimePickerColumnContext> = Symbol();

export function useTimePickerColumnContext(): TimePickerColumnContext {
  // With one argument, Vue shows a warning when there is no provider. The error below says more.
  const context = inject(TimePickerColumnContext, undefined);
  if (context === undefined) {
    throw new Error(
      'Vase UI: <TimePicker.ColumnItem> must be inside <TimePicker.Column>. Without a column the item has no unit to set. Put the item inside <TimePicker.Column>.',
    );
  }

  return context;
}
