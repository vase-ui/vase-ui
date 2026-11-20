<script setup lang="ts">
import { computed, mergeProps, useAttrs } from 'vue';
import { isKind } from '../common/date-time/temporal';
import { formatRangeText } from '../common/date-time/text';
import { usePickerTrigger } from '../common/picker/popup';
import { useLocale } from '../locale-provider/part';
import PopoverTrigger from '../popover/PopoverTrigger.vue';
import { injectDateRangePicker } from './root';
import type { DateRangePickerTriggerProps, DateRangePickerTriggerState } from './types';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<DateRangePickerTriggerProps>(), { disabled: false });
defineSlots<{
  default?(scope: { state: DateRangePickerTriggerState; text: string | undefined }): unknown;
  element?(scope: {
    props: Record<string, unknown>;
    elementRef: (target: unknown) => void;
    state: DateRangePickerTriggerState;
    text: string | undefined;
  }): unknown;
}>();

const picker = injectDateRangePicker('Trigger');
const attrs = useAttrs();
const locale = useLocale(() => picker.props.locale);
const trigger = usePickerTrigger(picker, () => props.disabled);

const text = computed(() => {
  const [start, end] = picker.range;
  if (start === null || end === null) return undefined;
  const timeStyle = isKind(start, 'date')
    ? undefined
    : isKind(start, 'zonedDateTime')
      ? 'long'
      : 'short';
  return formatRangeText(start, end, { dateStyle: 'full', timeStyle }, locale.value);
});

function triggerProps() {
  return mergeProps(attrs, trigger.owned());
}

defineExpose({ element: trigger.element });
</script>

<template>
  <PopoverTrigger v-if="$slots.element" :ref="trigger.setTrigger" v-bind="triggerProps()">
    <template #element="scope">
      <slot name="element" v-bind="scope" :text="text" />
    </template>
  </PopoverTrigger>
  <PopoverTrigger v-else :ref="trigger.setTrigger" v-bind="triggerProps()">
    <template #default="{ state }">
      <slot :state="state" :text="text" />
    </template>
  </PopoverTrigger>
</template>
