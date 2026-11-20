<script setup lang="ts" generic="Value extends DateValue = DateValue">
import { computed, mergeProps, provide, shallowRef, useAttrs, watch } from 'vue';
import { displayCalendar } from '../common/date-time/displayCalendar';
import { assertTemporal, type DateValue } from '../common/date-time/temporal';
import { extendPicker, usePicker } from '../common/picker/root';
import { useLocale } from '../locale-provider/part';
import PopoverRoot from '../popover/PopoverRoot.vue';
import { dateRangePickerKey, sameRange, useRangeControl } from './root';
import type {
  DateRangePickerRootChangeEventDetails,
  DateRangePickerRootOpenChangeEventDetails,
  DateRangePickerRootProps,
  DateRangePickerRootValue,
} from './types';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<DateRangePickerRootProps<Value>>(), {
  modelValue: undefined,
  defaultValue: undefined,
  open: undefined,
  defaultOpen: false,
  modal: false,
  closeOnSelect: undefined,
});
const emit = defineEmits<{
  /**
   * The user changes the range. An end is `null` while a segment of its field is empty.
   * `details.cancel()` keeps the range as it was.
   */
  valueChange: [
    value: DateRangePickerRootValue<Value>,
    details: DateRangePickerRootChangeEventDetails,
  ];
  /** Comes after `valueChange`, unless a listener cancels the change. `v-model` uses it. */
  'update:modelValue': [value: DateRangePickerRootValue<Value>];
  /** The popup opens or closes. `details.cancel()` keeps it as it was. */
  openChange: [open: boolean, details: DateRangePickerRootOpenChangeEventDetails];
  /** Comes after `openChange`, unless a listener cancels the change. `v-model:open` uses it. */
  'update:open': [open: boolean];
}>();
defineSlots<{ default?(): unknown }>();

assertTemporal('DateRangePicker.Root');

type Range = DateRangePickerRootValue;
const EMPTY: Range = [null, null];

const attrs = useAttrs();
const locale = useLocale(() => props.locale);
const { picker, field, readClock } = usePicker<Range, DateValue>(props, {
  emitChange: (value, details) =>
    emit(
      'valueChange',
      (value ?? EMPTY) as DateRangePickerRootValue<Value>,
      details as DateRangePickerRootChangeEventDetails,
    ),
  emitModel: (value) => emit('update:modelValue', (value ?? EMPTY) as DateRangePickerRootValue<Value>),
  templateOf: ([start, end]) => start ?? end,
  same: sameRange,
  fallback: (today) =>
    props.referenceDate ??
    (props.granularity === undefined || props.granularity === 'day'
      ? today
      : today.toPlainDateTime()),
  closes: () => true,
});
watch(
  () => props.open,
  (open) => {
    if (open) readClock();
  },
);
const range = computed(() => picker.value ?? EMPTY);
const control = useRangeControl(field, () => range.value, {
  disabled: () => picker.disabled,
  readonly: () => picker.readonly,
});
provide(
  dateRangePickerKey,
  extendPicker(extendPicker(picker, control), {
    props,
    get calendar() {
      return displayCalendar(props.calendar, picker.template, locale.value);
    },
    get range() {
      return range.value;
    },
  }),
);

const popover = shallowRef<{ close(): void } | null>(null);
function setPopover(value: unknown) {
  popover.value = value as { close(): void } | null;
}

function popoverProps() {
  return mergeProps(attrs, {
    open: props.open,
    defaultOpen: props.defaultOpen,
    modal: props.modal,
    handle: undefined,
    triggerId: undefined,
    defaultTriggerId: undefined,
    onOpenChange: (open: boolean, details: DateRangePickerRootOpenChangeEventDetails) =>
      emit('openChange', open, details),
    'onUpdate:open': (open: boolean) => {
      if (open) readClock();
      emit('update:open', open);
    },
  });
}

defineExpose({
  /** Closes the popup with the reason `'imperative-action'`. */
  close: () => popover.value?.close(),
});
</script>

<template>
  <PopoverRoot :ref="setPopover" v-bind="popoverProps()">
    <slot />
  </PopoverRoot>
</template>
