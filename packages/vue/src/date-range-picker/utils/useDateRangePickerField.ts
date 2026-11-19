import { computed, inject, provide, useAttrs } from 'vue';
import { useDeferredServerRender } from '../../common/deferredServerRender';
import { fieldKey } from '../../field/control';
import type { Ref } from 'vue';
import { given, givenAttributes } from '../../internals/givenAttributes';
import { createChangeEventDetails } from '../../internals/createVaseUIEventDetails';
import type { DateTimeFieldChangeEventDetails } from '../../internals/date-time/field/DateTimeFieldContext';
import { DateTimeFieldHostContext } from '../../internals/date-time/field/dateTimeFieldHost';
import { usePickerPartElement } from '../../internals/date-time/picker/usePickerPartElement';
import { usePickerPopup } from '../../internals/date-time/picker/usePickerPopup';
import { laterMinimum } from '../../internals/date-time/field/customValidity';
import type { DateValue } from '../../internals/date-time/temporal';
import { REASONS } from '../../internals/reasons';
import { useVaseUiId } from '../../internals/useVaseUiId';
import { useFormReset } from '../../internals/useFormReset';
import { mergeProps } from '../../merge-props';
import { useDateRangePickerRootContext } from '../root/DateRangePickerRootContext';

/** The members that `DateField.Root` exposes. */
export interface DateFieldActions {
  element: HTMLElement | null;
  inputElement: HTMLInputElement | null;
  clear: () => void;
}

/**
 * The state that the start field and the end field of a range picker share. A part calls it in
 * `setup`. Its template gives the filtered attributes to `fieldProps` for its end of the range.
 * @param end The end that the field shows.
 * @param field The ref of the `DateField.Root` that the part renders.
 * @param props The declared props of the part. The prop `ariaLabelledby` names the elements that
 * label the group.
 * @param defaultLabel The name of the field when the consumer gives none.
 */
export function useDateRangePickerField(
  end: 'start' | 'end',
  field: Readonly<Ref<DateFieldActions | null>>,
  props: { ariaLabelledby?: string | undefined },
  defaultLabel: string,
) {
  const attrs = useAttrs();
  const picker = useDateRangePickerRootContext();
  const popup = usePickerPopup();
  const index = end === 'start' ? 0 : 1;

  // The label of a `Field` around the picker names the picker, so it joins the name of each field. The
  // end field gives its content a field of its own, so each field reads the label here. The group of
  // the field has an id, so that `aria-labelledby` can name the group itself: its `aria-label`.
  const outerField = inject(fieldKey, null);
  // The label of the field can come after the picker.
  if (outerField) useDeferredServerRender();
  const fieldLabelId = computed(() => outerField?.labelId);
  const groupId = useVaseUiId().value;
  provide(DateTimeFieldHostContext, { groupId });

  const element = computed(() => field.value?.element ?? null);
  const inputElement = computed(() => field.value?.inputElement ?? null);

  usePickerPartElement(end === 'start' ? picker.startFields : picker.endFields, element);

  // The field holds the input of the form, so it hears about the reset.
  useFormReset(inputElement, (event) => {
    picker.reset(createChangeEventDetails(REASONS.none, event));
  });

  function handleKeydown(event: KeyboardEvent) {
    if (
      event.altKey &&
      event.key === 'ArrowDown' &&
      !event.defaultPrevented &&
      !picker.disabled.value &&
      !picker.props.readOnly
    ) {
      event.preventDefault();
      popup.openByKey(event);
    }
  }

  const fieldHandlers = { onKeydown: handleKeydown };

  function handleValueChange(value: DateValue | null, details: DateTimeFieldChangeEventDetails) {
    const [start, last] = picker.range.value;
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

  // The name of the group is its own name and the label of a `Field`, as in React Aria. A name that
  // the consumer gives with `aria-labelledby` replaces both.
  function ariaLabelledby() {
    const labelId = fieldLabelId.value;
    if (labelId === undefined || given('aria-labelledby', props.ariaLabelledby) !== undefined) {
      return undefined;
    }
    return typeof ariaLabel() === 'string' ? `${groupId} ${labelId}` : labelId;
  }

  function fieldProps(attributes: Record<string, unknown>) {
    const root = picker.props;
    const [start] = picker.range.value;
    const labelledby = ariaLabelledby();
    return {
      ...mergeProps(fieldHandlers, givenAttributes(attributes)),
      ...props,
      'aria-label': ariaLabel(),
      ariaLabelledby: labelledby ?? props.ariaLabelledby,
      modelValue: picker.range.value[index],
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
