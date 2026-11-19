<script lang="ts">
import type { HTMLAttributes } from 'vue';
import type {
  DateTimeFieldChangeEventDetails,
  DateTimeFieldChangeEventReason,
  DateTimeFieldRootState,
} from '../../internals/date-time/field/DateTimeFieldContext';
import type { DateTimeFieldGranularity } from '../../internals/date-time/field/useDateTimeFieldRoot';
import type { DateMatcher } from '../../internals/date-time/matchers';
import type { DateValue } from '../../internals/date-time/temporal';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../../internals/types';

/** The kinds of value that the field takes and gives back. */
export type DateFieldRootValue = DateValue | Temporal.PlainYearMonth;

export interface DateFieldRootState extends DateTimeFieldRootState {}

export type DateFieldRootGranularity = DateTimeFieldGranularity;

export type DateFieldRootChangeEventReason = DateTimeFieldChangeEventReason;
export type DateFieldRootChangeEventDetails = DateTimeFieldChangeEventDetails;

export interface DateFieldRootProps<Value extends DateFieldRootValue = DateFieldRootValue>
  extends
    VaseUIComponentProps<DateFieldRootState>,
    /* @vue-ignore */ Omit<WithVaseUIEvent<HTMLAttributes, 'aria-labelledby'>, 'id'> {
  /**
   * The id of the first segment.
   * Each other segment derives its id from it (`{id}-2`, `{id}-3`, and so on).
   */
  id?: string | undefined;
  /**
   * The value of the field: a `Temporal.PlainDate`, a `Temporal.PlainDateTime`, a
   * `Temporal.ZonedDateTime` or a `Temporal.PlainYearMonth`. The value that the field gives has
   * the kind, the calendar, the time and the time zone of the value that it got.
   *
   * To render an uncontrolled field, use the `defaultValue` prop instead.
   */
  modelValue?: Value | null | undefined;
  /**
   * The uncontrolled value of the field when it is initially rendered.
   *
   * To render a controlled field, use the `modelValue` prop instead.
   */
  defaultValue?: Value | null | undefined;
  /**
   * The date that gives the numbers of an empty segment, and the kind and the time zone of the
   * value that the field makes. A segment that is empty takes its number from this date when the
   * user presses an arrow key. With no reference date, the numbers come from today.
   */
  referenceDate?: DateFieldRootValue | undefined;
  /**
   * The last unit that the field shows. A date takes `day` or `month`, and shows `day` with no
   * prop. A year and month always shows `month`. A date with a time takes each unit, and shows
   * `minute` with no prop. With no value, the prop also gives the kind of the value that the field
   * makes.
   */
  granularity?: DateFieldRootGranularity | undefined;
  /**
   * The hour cycle of the time segments. With no prop, the hour cycle of the locale applies.
   */
  hourCycle?: 12 | 24 | undefined;
  /**
   * Whether the day, the month and the hour show a leading zero.
   * @default false
   */
  forceLeadingZeros?: boolean | undefined;
  /**
   * Whether the field hides the name of the time zone of a `Temporal.ZonedDateTime` value.
   * @default false
   */
  hideTimeZone?: boolean | undefined;
  /**
   * The earliest date that the field accepts. A date before it makes the field invalid. A
   * `Temporal.PlainDate` limits whole days. A limit with a time also limits the time of a field that
   * shows a time. A zoned limit limits a zoned value by the moment, also in another time zone.
   */
  minDate?: DateValue | undefined;
  /**
   * The latest date that the field accepts. A date after it makes the field invalid. A
   * `Temporal.PlainDate` limits whole days. A limit with a time also limits the time of a field that
   * shows a time. A zoned limit limits a zoned value by the moment, also in another time zone.
   */
  maxDate?: DateValue | undefined;
  /**
   * The dates that the field refuses. A date that it matches makes the field invalid. The matcher
   * is a date, a range of dates, a day of the week, a function or a list of these.
   */
  unavailableDates?: DateMatcher | undefined;
  /**
   * The locale that `Intl` uses for the layout, the names and the digits of the segments.
   * Defaults to the user's runtime locale.
   * When server rendering, `en-US` is used until hydration.
   */
  locale?: Intl.LocalesArgument | undefined;
  /**
   * The calendar in which the field shows its date, such as `gregory` or `persian`. With no
   * calendar, the field uses the calendar of its value when that calendar is not ISO. With neither,
   * it uses the calendar of the locale. The value that the field gives keeps its own calendar.
   */
  calendar?: string | undefined;
  /**
   * The time zone in which the field reads today. With no time zone, the field uses the zone of a
   * `Temporal.ZonedDateTime` value, and then the zone of the runtime.
   */
  timeZone?: string | undefined;
  /**
   * Whether the component should ignore user interaction.
   * @default false
   */
  disabled?: boolean | undefined;
  /**
   * Whether the user should be unable to change the value of the field.
   * @default false
   */
  readOnly?: boolean | undefined;
  /**
   * Whether the user must enter a value before submitting a form.
   * @default false
   */
  required?: boolean | undefined;
  /**
   * Identifies the field when a form is submitted.
   */
  name?: string | undefined;
  /**
   * A string specifying the `form` element with which the hidden input is associated.
   * This string's value must match the id of a `form` element in the same document.
   */
  form?: string | undefined;
  /**
   * The input autocomplete attribute of the hidden input.
   */
  autoComplete?: string | undefined;
  /**
   * The ids of the elements that name the group. With this prop, the group does not take the label
   * of the field.
   */
  ariaLabelledby?: string | undefined;
}
</script>

<script setup lang="ts" generic="Value extends DateFieldRootValue = DateFieldRootValue">
import { toRefs, useTemplateRef } from 'vue';
import { useDateTimeFieldRoot } from '../../internals/date-time/field/useDateTimeFieldRoot';
import { assertTemporal } from '../../internals/date-time/temporal';
import { fieldValidityMapping } from '../../internals/field-constants';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useRenderElement } from '../../internals/useRenderElement';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<DateFieldRootProps<Value>>(), {
  as: 'div',
  forceLeadingZeros: false,
  hideTimeZone: false,
  disabled: false,
  readOnly: false,
  required: false,
  modelValue: undefined,
});

const emit = defineEmits<{
  /**
   * Callback fired when the value changes.
   *
   * The `eventDetails.reason` indicates what triggered the change:
   * - `'input-change'` for typing or autofill
   * - `'input-clear'` when the user removes a digit with the text input
   * - `'input-paste'` for paste interactions
   * - `'keyboard'` for keys that change a segment
   * - `'clear-press'` when the user presses `DateField.Clear`
   * - `'none'` for a native reset of the form or a call of `clear()`
   *
   * The value is `null` while a segment is empty.
   */
  valueChange: [value: Value | null, eventDetails: DateFieldRootChangeEventDetails];
  /**
   * Event handler called after `valueChange` with the new value, unless a listener cancels the
   * change. `v-model` uses it.
   */
  'update:modelValue': [value: Value | null];
}>();

defineSlots<{
  /**
   * The content of the field, such as `DateField.Input`.
   */
  default(props: { state: DateFieldRootState }): unknown;
  render: ComponentRenderFn<HTMLProps, DateFieldRootState>;
}>();

assertTemporal('DateField.Root');

const inputElement = useTemplateRef<HTMLInputElement>('input');
const context = useDateTimeFieldRoot<Value>({
  ...toRefs(props),
  family: 'date',
  value: () => props.modelValue,
  hiddenInputElement: inputElement,
  valueChange: (value, details) => emit('valueChange', value, details),
  updateValue: (value) => emit('update:modelValue', value),
});

const { state } = context;

const { element, elementProps, setRef, usesRenderSlot } = useRenderElement('div', props, {
  state,
  stateAttributesMapping: fieldValidityMapping,
  ref: context.setRootElement,
  props: context.getRootProps,
});

defineExpose({
  element,
  inputElement: context.hiddenInputElement,
  /** Sets the value to `null` and empties each segment. The reason of the change is `none`. */
  clear: () => context.clear(),
});
</script>

<template>
  <slot v-if="usesRenderSlot()" name="render" :props="elementProps()" :state="state" />
  <component :is="as" v-else v-bind="elementProps()" :ref="setRef">
    <slot :state="state" />
  </component>
  <input ref="input" v-bind="context.hiddenInputProps()" />
</template>
