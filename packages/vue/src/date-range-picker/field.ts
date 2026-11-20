import { inject, mergeProps, provide, useAttrs, useId, watch } from 'vue';
import { dateTimeFieldHostKey } from '../common/date-time-field/field';
import type { DateTimeFieldChangeEventDetails } from '../common/date-time-field/field';
import { laterMinimum } from '../common/date-time-field/limits';
import { useDeferredServerRender } from '../common/deferredServerRender';
import type { DateValue } from '../common/date-time/temporal';
import { usePickerField } from '../common/picker/field';
import { fieldKey } from '../field/control';
import { injectDateRangePicker, type RangeEnd } from './root';

/** What `DateRangePicker.StartField` and `DateRangePicker.EndField` share. */
export function useRangeField(end: RangeEnd, part: string) {
  const picker = injectDateRangePicker(part);
  const attrs = useAttrs();
  const field = usePickerField(picker, part);
  // `aria-labelledby` of the group can name the group itself, and so its `aria-label`.
  const groupId = useId();
  provide(dateTimeFieldHostKey, { groupId });
  // The label of a `Field` can come after the picker.
  if (inject(fieldKey, null)) useDeferredServerRender();

  watch(
    field.element,
    (el, _, onCleanup) => {
      if (el) onCleanup(picker.addEnd(end, el));
    },
    { flush: 'post' },
  );

  function withEnd(value: DateValue | null) {
    const next = [...picker.range] as [DateValue | null, DateValue | null];
    next[end] = value;
    return next;
  }

  // The label of a `Field` names the picker, so it joins the name of each field. With no
  // `aria-label`, the group would take a name from its segments, so the label alone names it.
  function labelledBy() {
    const labelId = picker.labelId;
    if (labelId === undefined || attrs['aria-labelledby'] !== undefined) return undefined;
    return attrs['aria-label'] === undefined ? labelId : `${groupId} ${labelId}`;
  }

  function fieldProps() {
    const root = picker.props;
    return mergeProps(attrs, {
      'aria-labelledby': labelledBy() ?? attrs['aria-labelledby'],
      modelValue: picker.range[end],
      defaultValue: picker.template,
      referenceDate: root.referenceDate,
      granularity: root.granularity,
      hourCycle: root.hourCycle,
      forceLeadingZeros: root.forceLeadingZeros,
      hideTimeZone: root.hideTimeZone,
      // An end before the first end makes the end field invalid.
      min: end === 1 ? laterMinimum(root.min, picker.range[0]) : root.min,
      max: root.max,
      unavailableDates: root.unavailableDates,
      locale: root.locale,
      calendar: root.calendar,
      timeZone: root.timeZone,
      disabled: picker.disabled,
      readonly: root.readonly,
      required: root.required,
      name: end === 0 ? root.startName : root.endName,
      form: root.form,
      onValueChange: (value: DateValue | null, details: DateTimeFieldChangeEventDetails) =>
        picker.commit(withEnd(value), details),
      onKeydown: field.onKeydown,
      onFocusout: picker.onFocusout,
    });
  }

  return {
    field,
    fieldProps,
    exposed: {
      element: field.element,
      /** The input that gives the end to a form. */
      inputElement: field.inputElement,
      /** Empties each segment. `update:modelValue` follows when the end had a value. */
      clear() {
        field.clearSegments();
        picker.set(withEnd(null));
      },
    },
  };
}
