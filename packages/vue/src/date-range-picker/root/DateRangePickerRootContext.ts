import { inject, provide, useAttrs } from 'vue';
import type { InjectionKey, Ref } from 'vue';
import { DateTimeFieldHostContext } from '../../internals/date-time/field/DateTimeFieldContext';
import type { DateTimeFieldChangeEventDetails } from '../../internals/date-time/field/DateTimeFieldContext';
import { laterMinimum } from '../../internals/date-time/field/useDateTimeFieldRoot';
import { usePickerField } from '../../internals/date-time/picker/useDateTimePickerRoot';
import type {
  DateTimePickerContext,
  PickerFieldActions,
  PickerPartElements,
} from '../../internals/date-time/picker/useDateTimePickerRoot';
import type { DateValue } from '../../internals/date-time/temporal';
import { given, givenAttributes } from '../../internals/givenAttributes';
import { useControlLabelId } from '../../internals/labelable-provider';
import { useVaseUiId } from '../../internals/useVaseUiId';
import { mergeProps } from '../../merge-props';
import type {
  DateRangePickerRootChangeEventDetails,
  DateRangePickerRootProps,
} from './DateRangePickerRoot.vue';

/** The first day and the last day of the range that the picker holds. */
export type DateRangePickerRange = readonly [DateValue | null, DateValue | null];

export interface DateRangePickerRootContext extends DateTimePickerContext<
  DateRangePickerRange,
  DateValue,
  DateRangePickerRootChangeEventDetails
> {
  endFields: PickerPartElements;
  props: Readonly<DateRangePickerRootProps>;
}

export const DateRangePickerRootContext: InjectionKey<DateRangePickerRootContext> = Symbol();

export function useDateRangePickerRootContext(): DateRangePickerRootContext {
  const context = inject(DateRangePickerRootContext, undefined);
  if (context === undefined) {
    throw new Error(
      'Vase UI: A part of Date Range Picker must be inside <DateRangePicker.Root>. Without a root the part has no value and no popup to share. Put the part inside <DateRangePicker.Root>.',
    );
  }

  return context;
}

export function useDateRangePickerField(
  end: 'start' | 'end',
  field: Readonly<Ref<PickerFieldActions | null>>,
  props: { ariaLabelledby?: string | undefined },
  defaultLabel: string,
) {
  const attrs = useAttrs();
  const picker = useDateRangePickerRootContext();
  const index = end === 'start' ? 0 : 1;

  // Each endpoint shares the outer label and has its own group name.
  const fieldLabelId = useControlLabelId();
  const groupId = useVaseUiId().value;
  provide(DateTimeFieldHostContext, { groupId });

  const { element, inputElement, fieldHandlers } = usePickerField(
    field,
    end === 'start' ? picker.fields : picker.endFields,
    picker,
  );

  function handleValueChange(value: DateValue | null, details: DateTimeFieldChangeEventDetails) {
    const [start, last] = picker.value.value;
    picker.commit(end === 'start' ? [value, last] : [start, value], details);
  }

  // The name says which end the field shows. A name that the consumer gives replaces it, and `null`
  // removes it.
  function ariaLabel() {
    const ariaLabelValue = attrs['aria-label'];
    return ariaLabelValue === null ||
      (typeof ariaLabelValue === 'string' && given('aria-label', ariaLabelValue) !== undefined)
      ? ariaLabelValue
      : defaultLabel;
  }

  function ariaLabelledby() {
    const labelId = fieldLabelId.value;
    if (labelId === undefined || given('aria-labelledby', props.ariaLabelledby) !== undefined) {
      return undefined;
    }
    return typeof ariaLabel() === 'string' ? `${groupId} ${labelId}` : labelId;
  }

  function fieldProps(attributes: Record<string, unknown>) {
    const root = picker.props;
    const [start] = picker.value.value;
    const labelledby = ariaLabelledby();
    return {
      ...mergeProps(fieldHandlers, givenAttributes(attributes)),
      ...props,
      'aria-label': ariaLabel(),
      ariaLabelledby: labelledby ?? props.ariaLabelledby,
      modelValue: picker.value.value[index],
      // The end that gives the kind of a new end is the same kind for both fields.
      defaultValue: picker.template.value,
      referenceDate: root.referenceDate,
      granularity: root.granularity,
      hourCycle: root.hourCycle,
      forceLeadingZeros: root.forceLeadingZeros,
      hideTimeZone: root.hideTimeZone,
      // An end that is before the start makes the end field invalid. A start with a time limits the
      // time of the end too.
      minDate: end === 'end' ? laterMinimum(root.minDate, start) : root.minDate,
      maxDate: root.maxDate,
      unavailableDates: root.unavailableDates,
      locale: root.locale,
      calendar: root.calendar,
      timeZone: root.timeZone,
      disabled: root.disabled,
      readOnly: root.readOnly,
      required: root.required,
      name: end === 'start' ? root.startName : root.endName,
      form: root.form,
    };
  }

  return { element, inputElement, handleValueChange, fieldProps };
}
