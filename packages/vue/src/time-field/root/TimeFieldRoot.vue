<script lang="ts">
import type { HTMLAttributes } from 'vue';
import type {
  DateTimeFieldChangeEventDetails,
  DateTimeFieldChangeEventReason,
  DateTimeFieldRootState,
} from '../../internals/date-time/field/DateTimeFieldContext';
import type { TimeValue } from '../../internals/date-time/temporal';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../../internals/types';

export type TimeFieldRootState = DateTimeFieldRootState;

/** The kinds of value that the field takes and gives. */
export type TimeFieldRootValue = TimeValue;

export type TimeFieldRootGranularity = 'hour' | 'minute' | 'second';

export type TimeFieldRootChangeEventReason = DateTimeFieldChangeEventReason;
export type TimeFieldRootChangeEventDetails = DateTimeFieldChangeEventDetails;

export interface TimeFieldRootProps<Value extends TimeFieldRootValue = Temporal.PlainTime>
  extends
    VaseUIComponentProps<TimeFieldRootState>,
    /* @vue-ignore */ Omit<WithVaseUIEvent<HTMLAttributes, 'aria-labelledby'>, 'id'> {
  /**
   * The value of the field, or `null` when the field is empty.
   * The field gives back a value of the same kind: a time, a date and time, or a date and time in
   * a time zone. A new value keeps the date and the time zone of the present value.
   *
   * To render an uncontrolled field, use the `defaultValue` prop instead.
   */
  modelValue?: Value | null | undefined;
  /**
   * The value of an uncontrolled field when it first renders.
   *
   * To render a controlled field, use the `modelValue` prop instead.
   */
  defaultValue?: Value | null | undefined;
  /**
   * A value that gives its kind, its date and its time zone to a new value.
   * The segments that the user did not fill start with the numbers of this value.
   * With no value, no `defaultValue` and no `referenceDate`, a new value is a `Temporal.PlainTime`.
   */
  referenceDate?: Value | undefined;
  /**
   * The smallest unit that the field shows.
   * @default 'minute'
   */
  granularity?: TimeFieldRootGranularity | undefined;
  /**
   * The hour cycle. `12` shows a day period, and `24` shows none.
   * The default is the hour cycle of the locale.
   */
  hourCycle?: 12 | 24 | undefined;
  /**
   * Whether the hour has a leading zero. The hour of a 24-hour cycle always has one.
   * @default false
   */
  forceLeadingZeros?: boolean | undefined;
  /**
   * Whether to hide the time zone name of a value in a time zone.
   * @default false
   */
  hideTimeZone?: boolean | undefined;
  /**
   * The earliest time that the field accepts.
   * The hidden input gives `rangeUnderflow` to the field for an earlier time.
   */
  minTime?: Temporal.PlainTime | undefined;
  /**
   * The latest time that the field accepts.
   * The hidden input gives `rangeOverflow` to the field for a later time.
   */
  maxTime?: Temporal.PlainTime | undefined;
  /**
   * The `step` of the hidden input, in seconds.
   * The hidden input gives `stepMismatch` to the field for a time that is not a multiple of the step
   * from `minTime`, or from midnight with no `minTime`.
   */
  step?: number | undefined;
  /**
   * The locale that gives the order of the segments, the text between them and the default hour
   * cycle. The default is the runtime locale of the user.
   * When server rendering, `en-US` is used until hydration.
   */
  locale?: Intl.LocalesArgument | undefined;
  /**
   * Whether the field ignores user interaction.
   * @default false
   */
  disabled?: boolean | undefined;
  /**
   * Whether the user cannot change the value of the field.
   * @default false
   */
  readOnly?: boolean | undefined;
  /**
   * Whether the user must enter a value before a form submits.
   * @default false
   */
  required?: boolean | undefined;
  /**
   * Identifies the field when a form submits.
   */
  name?: string | undefined;
  /**
   * A string that names the `form` element with which the hidden input is associated.
   * The string must match the `id` of a `form` element in the same document.
   */
  form?: string | undefined;
  /**
   * The id of the first segment. The other segments take ids that derive from it.
   */
  id?: string | undefined;
  /**
   * The `autocomplete` attribute of the hidden input.
   */
  autoComplete?: string | undefined;
  /**
   * The ids of the elements that name the group. With this prop, the group does not take the label
   * of the field.
   */
  ariaLabelledby?: string | undefined;
}
</script>

<script setup lang="ts" generic="Value extends TimeFieldRootValue = Temporal.PlainTime">
import { toRefs, useTemplateRef } from 'vue';
import {
  rootStateAttributesMapping,
  useDateTimeFieldRoot,
} from '../../internals/date-time/field/useDateTimeFieldRoot';
import { assertTemporal } from '../../internals/date-time/temporal';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useRenderElement } from '../../internals/useRenderElement';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<TimeFieldRootProps<Value>>(), {
  as: 'div',
  modelValue: undefined,
  forceLeadingZeros: false,
  hideTimeZone: false,
  disabled: false,
  readOnly: false,
  required: false,
});

const emit = defineEmits<{
  /**
   * Event fired when the value changes.
   * The value is `null` when the field has a segment with no number.
   *
   * The `eventDetails.reason` says what caused the change:
   *
   * - `'input-change'` for typed digits and for a text that a browser fills in the hidden input
   * - `'input-clear'` when the browser removes the text of a segment
   * - `'input-paste'` for pasted text
   * - `'keyboard'` for a key that changes a segment
   * - `'clear-press'` for a press on `TimeField.Clear`
   * - `'none'` for a reset of the form and for the `clear` method
   */
  valueChange: [value: Value | null, eventDetails: TimeFieldRootChangeEventDetails];
  /**
   * Event fired after `valueChange` with the new value, unless a listener cancels the change.
   * `v-model` uses it.
   */
  'update:modelValue': [value: Value | null];
}>();

defineSlots<{
  default(props: { state: TimeFieldRootState }): unknown;
  render: ComponentRenderFn<HTMLProps, TimeFieldRootState>;
}>();

assertTemporal('TimeField.Root');

const inputElement = useTemplateRef<HTMLInputElement>('input');
const context = useDateTimeFieldRoot<Value>({
  ...toRefs(props),
  family: 'time',
  value: () => props.modelValue,
  hiddenInputElement: inputElement,
  valueChange: (value, details) => emit('valueChange', value, details),
  updateValue: (value) => emit('update:modelValue', value),
});

const { state } = context;

const { element, elementProps, setRef, usesRenderSlot } = useRenderElement('div', props, {
  state,
  stateAttributesMapping: rootStateAttributesMapping,
  ref: context.setRootElement,
  props: context.getRootProps,
});


defineExpose({
  element,
  /** The hidden input that holds the value of the field for a form. */
  inputElement: context.hiddenInputElement,
  /** Empties the field. The reason of the change is `none`. */
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
