import { inject } from 'vue';
import type { ComputedRef, InjectionKey } from 'vue';
import type { DateTimePickerContext } from '../../internals/date-time/picker/useDateTimePickerRoot';
import type {
  DatePickerRootChangeEventDetails,
  DatePickerRootProps,
  DatePickerRootValue,
} from './DatePickerRoot.vue';

export interface DatePickerRootContext extends DateTimePickerContext<
  DatePickerRootValue,
  DatePickerRootChangeEventDetails
> {
  /** The props of the root. Its parts read the props that they share. */
  props: Readonly<DatePickerRootProps>;
  /**
   * Whether the picker ignores user interaction: its `disabled` prop, or a disabled field or
   * fieldset around it.
   */
  disabled: ComputedRef<boolean>;
}

export const DatePickerRootContext: InjectionKey<DatePickerRootContext> = Symbol();

export function useDatePickerRootContext(): DatePickerRootContext {
  // With one argument, Vue shows a warning when there is no provider. The error below says more.
  const context = inject(DatePickerRootContext, undefined);
  if (context === undefined) {
    throw new Error(
      'Vase UI: A part of Date Picker must be inside <DatePicker.Root>. Without a root the part has no value and no popup to share. Put the part inside <DatePicker.Root>.',
    );
  }

  return context;
}
