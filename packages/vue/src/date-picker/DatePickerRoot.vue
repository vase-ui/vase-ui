<script setup lang="ts" generic="Value extends DatePickerRootValue = DatePickerRootValue">
import { mergeProps, provide, shallowRef, useAttrs } from 'vue';
import { displayCalendar } from '../common/date-time/displayCalendar';
import { assertTemporal, sameTemporal } from '../common/date-time/temporal';
import { mergeGetters, usePicker } from '../common/picker/root';
import { useLocale } from '../locale-provider/part';
import PopoverRoot from '../popover/PopoverRoot.vue';
import { datePickerKey } from './root';
import { hasTime, templateOf } from './template';
import type {
  DatePickerRootChangeEventDetails,
  DatePickerRootOpenChangeEventDetails,
  DatePickerRootProps,
  DatePickerRootValue,
} from './types';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<DatePickerRootProps<Value>>(), {
  modelValue: undefined,
  defaultValue: undefined,
  open: undefined,
  defaultOpen: false,
  modal: false,
  closeOnSelect: undefined,
});
const emit = defineEmits<{
  /**
   * The user changes the value. The value is `null` while a segment is empty.
   * `details.cancel()` keeps the value as it was.
   */
  valueChange: [value: Value | null, details: DatePickerRootChangeEventDetails];
  /**
   * Comes after `valueChange`, unless a listener cancels the change. `v-model` uses it. A reset of
   * the form and `clear()` of a field emit it with no `valueChange`.
   */
  'update:modelValue': [value: Value | null];
  /** The popup opens or closes. `details.cancel()` keeps it as it was. */
  openChange: [open: boolean, details: DatePickerRootOpenChangeEventDetails];
  /** Comes after `openChange`, unless a listener cancels the change. `v-model:open` uses it. */
  'update:open': [open: boolean];
}>();
defineSlots<{ default?(): unknown }>();

assertTemporal('DatePicker.Root');

const attrs = useAttrs();
const shownLocale = useLocale(() => props.locale);
const { picker, readClock } = usePicker<DatePickerRootValue>(props, {
  emitChange: (value, details) =>
    emit('valueChange', value as Value | null, details as DatePickerRootChangeEventDetails),
  emitModel: (value) => emit('update:modelValue', value as Value | null),
  same: sameTemporal,
  fallback: (today) => props.referenceDate ?? templateOf(props.granularity, props.calendar, today),
  closes: (template) => !hasTime(template),
});
provide(
  datePickerKey,
  mergeGetters(picker, {
    props,
    get calendar() {
      return displayCalendar(props.calendar, picker.template, shownLocale.value);
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
    onOpenChange: (open: boolean, details: DatePickerRootOpenChangeEventDetails) =>
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
