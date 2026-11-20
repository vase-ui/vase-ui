<script setup lang="ts">
import { computed, mergeProps, useAttrs } from 'vue';
import { isKind } from '../common/date-time/temporal';
import { formatText } from '../common/date-time/text';
import { usePickerTrigger } from '../common/picker/popup';
import PopoverTrigger from '../popover/PopoverTrigger.vue';
import { injectTimePicker } from './root';
import { hourCycleOption } from './times';
import type { TimePickerTriggerProps, TimePickerTriggerState } from './types';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<TimePickerTriggerProps>(), { disabled: false });
defineSlots<{
  default?(scope: { state: TimePickerTriggerState; text: string | undefined }): unknown;
  element?(scope: {
    props: Record<string, unknown>;
    elementRef: (target: unknown) => void;
    state: TimePickerTriggerState;
    text: string | undefined;
  }): unknown;
}>();

const picker = injectTimePicker('Trigger');
const attrs = useAttrs();
const trigger = usePickerTrigger(picker, () => props.disabled);

const text = computed(() => {
  const value = picker.value;
  if (value === null) return undefined;
  return formatText(
    value,
    {
      hour: 'numeric',
      minute: '2-digit',
      second: picker.props.granularity === 'second' ? '2-digit' : undefined,
      hourCycle: hourCycleOption(picker.props.hourCycle),
      timeZoneName: isKind(value, 'zonedDateTime') ? 'short' : undefined,
    },
    picker.locale,
  );
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
