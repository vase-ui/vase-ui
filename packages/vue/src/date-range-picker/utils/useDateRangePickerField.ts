import { computed, useAttrs, watch } from 'vue';
import type { Ref } from 'vue';
import { givenName } from '../../internals/blankName';
import { createChangeEventDetails } from '../../internals/createBaseUIEventDetails';
import type { DateTimeFieldChangeEventDetails } from '../../internals/date-time/field/DateTimeFieldContext';
import { usePickerPopup } from '../../internals/date-time/picker/usePickerPopup';
import { compareDates } from '../../internals/date-time/temporal';
import type { DateValue } from '../../internals/date-time/temporal';
import { omitUndefinedAttributes } from '../../internals/omitUndefinedAttributes';
import { REASONS } from '../../internals/reasons';
import { useFormReset } from '../../internals/useFormReset';
import { mergeProps } from '../../merge-props';
import { createElementSetter } from '../../utils/popups/createElementSetter';
import { useDateRangePickerRootContext } from '../root/DateRangePickerRootContext';

/** The members that `DateField.Root` exposes. */
export interface DateFieldActions {
  element: HTMLElement | null;
  inputElement: HTMLInputElement | null;
  clear: () => void;
}

/** The later of two days. */
function laterDay(a: DateValue | undefined, b: DateValue | null): DateValue | undefined {
  return b !== null && (a === undefined || compareDates(b, a) > 0) ? b : a;
}

/**
 * The state that the start field and the end field of a range picker share. A part calls it in
 * `setup`. It binds one end of the range of the picker to the `DateField.Root` that the part renders.
 * @param end The end that the field shows.
 * @param field The ref of the `DateField.Root` that the part renders.
 * @param props The declared props of the part.
 * @param defaultLabel The name of the field when the consumer gives none.
 */
export function useDateRangePickerField(
  end: 'start' | 'end',
  field: Readonly<Ref<DateFieldActions | null>>,
  props: object,
  defaultLabel: string,
) {
  const attrs = useAttrs();
  const picker = useDateRangePickerRootContext();
  const popup = usePickerPopup();
  const index = end === 'start' ? 0 : 1;

  const element = computed(() => field.value?.element ?? null);
  const inputElement = computed(() => field.value?.inputElement ?? null);

  const setFieldElement = createElementSetter(
    end === 'start' ? picker.startFieldElement : picker.endFieldElement,
  );
  watch(element, setFieldElement, { immediate: true, flush: 'post' });

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
    const given = attrs['aria-label'];
    return given === null || (typeof given === 'string' && givenName(given) !== undefined)
      ? given
      : defaultLabel;
  }

  function fieldProps() {
    const root = picker.props;
    const [start] = picker.range.value;
    return {
      ...mergeProps(fieldHandlers, omitUndefinedAttributes(attrs)),
      ...props,
      'aria-label': ariaLabel(),
      value: picker.range.value[index],
      // The end that gives the kind of a new end is the same kind for both fields.
      defaultValue: picker.template.value,
      referenceDate: root.referenceDate,
      granularity: root.granularity,
      hourCycle: root.hourCycle,
      forceLeadingZeros: root.forceLeadingZeros,
      hideTimeZone: root.hideTimeZone,
      // An end that is before the start makes the end field invalid.
      minDate: end === 'end' ? laterDay(root.minDate, start) : root.minDate,
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
