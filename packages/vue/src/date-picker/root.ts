import { inject, type InjectionKey } from 'vue';
import { createError } from '../common/createError';
import type { PickerForPart } from '../common/picker/root';
import type { DatePickerRootProps, DatePickerRootValue } from './types';

/** What `DatePicker.Root` gives to its parts. The properties are reactive. */
export interface DatePickerForPart extends PickerForPart<DatePickerRootValue> {
  readonly props: Readonly<DatePickerRootProps>;
  /** The calendar that the field shows, so that the grid shows it too. */
  readonly calendar: string;
}

export const datePickerKey: InjectionKey<DatePickerForPart> = Symbol(
  process.env.NODE_ENV !== 'production' ? 'date picker' : undefined,
);

/** The root of the part. A part with no root throws an error that names it. */
export function injectDatePicker(part: string): DatePickerForPart {
  const picker = inject(datePickerKey, null);
  if (!picker) {
    throw createError(22, part);
  }
  return picker;
}
