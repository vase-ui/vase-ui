<script setup lang="ts">
import { computed, mergeProps, useAttrs } from 'vue';
import { isKind } from '../common/date-time/temporal';
import { formatText } from '../common/date-time/text';
import { usePickerTrigger } from '../common/picker/popup';
import { useLocale } from '../locale-provider/part';
import PopoverTrigger from '../popover/PopoverTrigger.vue';
import { injectDatePicker } from './root';
import type { DatePickerTriggerProps, DatePickerTriggerState } from './types';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<DatePickerTriggerProps>(), { disabled: false });
defineSlots<{
  default?(scope: { state: DatePickerTriggerState; text: string | undefined }): unknown;
  element?(scope: {
    props: Record<string, unknown>;
    elementRef: (target: unknown) => void;
    state: DatePickerTriggerState;
    text: string | undefined;
  }): unknown;
}>();

const picker = injectDatePicker('Trigger');
const attrs = useAttrs();
const locale = useLocale(() => picker.props.locale);
const trigger = usePickerTrigger(picker, () => props.disabled);

const text = computed(() => {
  const value = picker.value;
  if (value === null) return undefined;
  if (isKind(value, 'yearMonth')) {
    return formatText(value, { month: 'long', year: 'numeric' }, locale.value);
  }
  const timeStyle = isKind(value, 'date')
    ? undefined
    : isKind(value, 'zonedDateTime')
      ? 'long'
      : 'short';
  return formatText(value, { dateStyle: 'full', timeStyle }, locale.value);
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
