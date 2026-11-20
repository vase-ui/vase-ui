import { inject, type InjectionKey } from 'vue';
import type { PickerForPart } from '../common/picker/root';
import type { DatePickerRootProps, DatePickerRootValue } from './types';

/** What `DatePicker.Root` gives to its parts. The properties are reactive. */
export interface DatePickerForPart extends PickerForPart<DatePickerRootValue> {
  readonly props: Readonly<DatePickerRootProps>;
  /** The calendar that the field shows, so that the grid shows it too. */
  readonly calendar: string;
}

export const datePickerKey: InjectionKey<DatePickerForPart> = Symbol('date picker');

/** The root of the part. A part with no root throws an error that names it. */
export function injectDatePicker(part: string): DatePickerForPart {
  const picker = inject(datePickerKey, null);
  if (!picker) {
    throw new Error(
      `Vase UI: <DatePicker.${part}> must be inside <DatePicker.Root>. Without a root the part has no value and no popup. Put the part inside <DatePicker.Root>.`,
    );
  }
  return picker;
}
