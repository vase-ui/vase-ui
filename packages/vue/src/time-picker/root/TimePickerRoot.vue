<script lang="ts">
import type { VaseUIChangeEventDetails } from '../../internals/createVaseUIEventDetails';
import type { TimeValue } from '../../internals/date-time/temporal';
import type {
  PopoverRootActions,
  PopoverRootChangeEventDetails,
  PopoverRootChangeEventReason,
  PopoverRootProps,
} from '../../popover/root/PopoverRoot.vue';
import type { TimeClockRootChangeEventReason } from '../../time-clock/root/TimeClockRoot.vue';
import type {
  TimeFieldRootChangeEventReason,
  TimeFieldRootGranularity,
} from '../../time-field/root/TimeFieldRoot.vue';

export interface TimePickerRootState {}

/** The kinds of value that the picker takes and gives back. */
export type TimePickerRootValue = TimeValue;

export type TimePickerRootGranularity = TimeFieldRootGranularity;

export type TimePickerRootChangeEventReason =
  TimeFieldRootChangeEventReason | TimeClockRootChangeEventReason;
export type TimePickerRootChangeEventDetails =
  VaseUIChangeEventDetails<TimePickerRootChangeEventReason>;

export type TimePickerRootOpenChangeEventReason = PopoverRootChangeEventReason;
export type TimePickerRootOpenChangeEventDetails = PopoverRootChangeEventDetails;

export type TimePickerRootActions = PopoverRootActions;

export interface TimePickerRootProps<
  Value extends TimePickerRootValue = Temporal.PlainTime,
> extends Omit<PopoverRootProps, 'handle' | 'triggerId' | 'defaultTriggerId'> {
  /**
   * The value of the picker: a `Temporal.PlainTime`, a `Temporal.PlainDateTime` or a
   * `Temporal.ZonedDateTime`. The value that the picker gives has the kind, the date and the time
   * zone of the value that it got. The value is `null` while the picker has none.
   *
   * To render an uncontrolled picker, use the `defaultValue` prop instead.
   */
  modelValue?: Value | null | undefined;
  /**
   * The uncontrolled value of the picker when it is initially rendered.
   *
   * To render a controlled picker, use the `modelValue` prop instead.
   */
  defaultValue?: Value | null | undefined;
  /**
   * Whether a selection closes the popup.
   * A press on an item of `TimePicker.List` and the last commit of `TimePicker.Clock` close the popup
   * by default. A press on an item of `TimePicker.Column` does not, because the user sets more than
   * one unit.
   */
  closeOnSelect?: boolean | undefined;
  /**
   * The smallest unit that the field shows and that the clock selects.
   * @default 'minute'
   */
  granularity?: TimePickerRootGranularity | undefined;
  /**
   * A value that gives its kind, its date and its time zone to the first value of the picker.
   * The segments of the field that the user did not fill start with the numbers of this value.
   * While the picker has no value, the clock shows its time, and a column sets one unit of it.
   * With no reference date, the time starts at midnight and the first value is a
   * `Temporal.PlainTime`. A default value, or a value that the picker had earlier, gives its kind in
   * the place of this value.
   */
  referenceDate?: Value | undefined;
  /**
   * The hour cycle. `12` shows a day period, and `24` shows none.
   * The default is the hour cycle of the locale.
   */
  hourCycle?: 12 | 24 | undefined;
  /**
   * Whether the hour of the field has a leading zero. The hour of a 24-hour cycle always has one.
   * @default false
   */
  forceLeadingZeros?: boolean | undefined;
  /**
   * Whether the field hides the name of the time zone of a `Temporal.ZonedDateTime` value.
   * @default false
   */
  hideTimeZone?: boolean | undefined;
  /**
   * The earliest time that the picker accepts.
   * The list starts at this time. The columns and the clock disable a value that has no time at or
   * after it, and a pick that gives an earlier time moves the time to it. An earlier time in the
   * field makes the picker invalid.
   */
  minTime?: Temporal.PlainTime | undefined;
  /**
   * The latest time that the picker accepts.
   * The list ends at this time. The columns and the clock disable a value that has no time at or
   * before it, and a pick that gives a later time moves the time to it. A later time in the field
   * makes the picker invalid.
   */
  maxTime?: Temporal.PlainTime | undefined;
  /**
   * The locale that gives the order of the segments, the text between them, the texts of the list
   * and of the columns, and the default hour cycle. The default is the runtime locale of the user.
   * When server rendering, `en-US` is used until hydration.
   */
  locale?: Intl.LocalesArgument | undefined;
  /**
   * Whether the component should ignore user interaction.
   * @default false
   */
  disabled?: boolean | undefined;
  /**
   * Whether the user should be unable to change the value. The user cannot open the popup of a
   * read-only picker.
   * @default false
   */
  readOnly?: boolean | undefined;
  /**
   * Whether the user must enter a value before submitting a form.
   * @default false
   */
  required?: boolean | undefined;
  /**
   * Identifies the picker when a form is submitted.
   */
  name?: string | undefined;
  /**
   * A string specifying the `form` element with which the hidden input is associated.
   * This string's value must match the id of a `form` element in the same document.
   */
  form?: string | undefined;
}
</script>

<script setup lang="ts" generic="Value extends TimePickerRootValue = Temporal.PlainTime">
import { computed, provide, useTemplateRef } from 'vue';
import { useDateTimePickerRoot } from '../../internals/date-time/picker/useDateTimePickerRoot';
import { assertTemporal, toPlainTime } from '../../internals/date-time/temporal';
import { useCastBooleanWarning } from '../../internals/useCastBooleanWarning';
import { withoutPropsOf } from '../../internals/withoutPropsOf';
import PopoverRoot from '../../popover/root/PopoverRoot.vue';
import { TimePickerRootContext } from './TimePickerRootContext';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<TimePickerRootProps<Value>>(), {
  open: undefined,
  defaultOpen: false,
  modal: false,
  modelValue: undefined,
  closeOnSelect: undefined,
  forceLeadingZeros: false,
  hideTimeZone: false,
  disabled: false,
  readOnly: false,
  required: false,
});

if (process.env.NODE_ENV !== 'production') {
  useCastBooleanWarning('TimePicker.Root');
}

const emit = defineEmits<{
  /**
   * Event handler called when the value changes. The value is `null` while a segment of the field
   * is empty.
   *
   * The `eventDetails.reason` says what caused the change:
   * - `'item-press'` for a press on an item of the list or of a column, and on a day period of
   *   the clock
   * - `'drag'` and `'keyboard'` for a press, a drag or a key on the clock face
   * - `'input-change'` for typing or autofill in the field, and for the input of the clock face
   * - `'input-clear'` when the user removes a digit with the text input
   * - `'input-paste'` for paste interactions
   * - `'keyboard'` for keys that change a segment
   * - `'clear-press'` when the user presses a clear button
   * - `'none'` for a native reset of the form or a call of `clear()` of the field
   */
  valueChange: [value: Value | null, eventDetails: TimePickerRootChangeEventDetails];
  /**
   * Event handler called after `valueChange` with the new value, unless a listener cancels the
   * change. `v-model` uses it.
   */
  'update:modelValue': [value: Value | null];
  /**
   * Event handler called when the popup is opened or closed.
   *
   * The `eventDetails.reason` is `'trigger-press'` for the trigger, and for Alt+Down in the field.
   * It is `'imperative-action'` for a close after a selection.
   */
  openChange: [open: boolean, eventDetails: TimePickerRootOpenChangeEventDetails];
  /**
   * Event handler called after `openChange` with the new value, unless a listener cancels the
   * change. `v-model:open` uses it.
   */
  'update:open': [open: boolean];
  /**
   * Event handler called after any animations complete when the popup is opened or closed.
   */
  openChangeComplete: [open: boolean];
}>();

defineSlots<{
  /**
   * The content of the picker, such as `TimePicker.Field`.
   */
  default(): unknown;
}>();

assertTemporal('TimePicker.Root');

const referenceTime = computed(() =>
  props.referenceDate === undefined ? new Temporal.PlainTime() : toPlainTime(props.referenceDate),
);

const picker = useDateTimePickerRoot<
  TimePickerRootValue | null,
  TimePickerRootValue,
  TimePickerRootChangeEventDetails
>(props, {
  name: 'TimePicker',
  empty: null,
  templateOf: (value) => value,
  fallback: () => props.referenceDate ?? referenceTime.value,
  valueChange: (value, details) => emit('valueChange', value as Value | null, details),
  updateValue: (value) => emit('update:modelValue', value as Value | null),
});

// A part of the popup changes the time of the value. While the picker has no value, it starts at
// the time of the reference date.
const time = computed(() =>
  picker.value.value === null ? referenceTime.value : toPlainTime(picker.value.value),
);

provide(TimePickerRootContext, {
  ...picker,
  props,
  time,
  referenceTime,
});

const popover = useTemplateRef<TimePickerRootActions>('popover');

defineExpose<TimePickerRootActions>({
  unmount: () => popover.value?.unmount(),
  close: () => popover.value?.close(),
});
</script>

<template>
  <PopoverRoot
    ref="popover"
    v-bind="withoutPropsOf($attrs, PopoverRoot)"
    :open="props.open"
    :default-open="props.defaultOpen"
    :modal="props.modal"
    @open-change="(open, details) => emit('openChange', open, details)"
    @update:open="(open) => emit('update:open', open)"
    @open-change-complete="(open) => emit('openChangeComplete', open)"
  >
    <slot />
  </PopoverRoot>
</template>
