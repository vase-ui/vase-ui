<script setup lang="ts" generic="Value extends TimePickerRootValue = Temporal.PlainTime">
import { computed, mergeProps, provide, shallowRef, useAttrs } from 'vue';
import { hourCycleOf } from '../common/date-time/format';
import { assertTemporal, sameTemporal, toPlainTime } from '../common/date-time/temporal';
import { mergeGetters, usePicker } from '../common/picker/root';
import { useLocale } from '../locale-provider/part';
import PopoverRoot from '../popover/PopoverRoot.vue';
import { timePickerKey } from './root';
import type {
  TimePickerRootChangeEventDetails,
  TimePickerRootEmits,
  TimePickerRootOpenChangeEventDetails,
  TimePickerRootProps,
  TimePickerRootValue,
} from './types';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<TimePickerRootProps<Value>>(), {
  modelValue: undefined,
  defaultValue: undefined,
  open: undefined,
  defaultOpen: false,
  modal: false,
  closeOnSelect: undefined,
  granularity: 'minute',
});
const emit = defineEmits<TimePickerRootEmits<Value>>();
defineSlots<{ default?(): unknown }>();

assertTemporal('TimePicker.Root');

const attrs = useAttrs();
const shownLocale = useLocale(() => props.locale);
const { picker } = usePicker<TimePickerRootValue>(props, {
  emitChange: (value, details) =>
    emit('valueChange', value as Value | null, details as TimePickerRootChangeEventDetails),
  emitModel: (value) => emit('update:modelValue', value as Value | null),
  same: sameTemporal,
  fallback: () => props.referenceDate ?? new Temporal.PlainTime(),
  closes: () => true,
});
const shownHourCycle = computed(() => props.hourCycle ?? hourCycleOf(shownLocale.value));
const time = computed(() => {
  const like = picker.value ?? props.referenceDate;
  return like ? toPlainTime(like) : new Temporal.PlainTime();
});
provide(
  timePickerKey,
  mergeGetters(picker, {
    props,
    get locale() {
      return shownLocale.value;
    },
    get hourCycle() {
      return shownHourCycle.value;
    },
    get time() {
      return time.value;
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
    onOpenChange: (open: boolean, details: TimePickerRootOpenChangeEventDetails) =>
      emit('openChange', open, details),
    'onUpdate:open': (open: boolean) => emit('update:open', open),
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
