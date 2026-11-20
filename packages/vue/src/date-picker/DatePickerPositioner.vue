<script setup lang="ts">
import { mergeProps, useAttrs } from 'vue';
import { usePickerPart } from '../common/picker/popup';
import PopoverPositioner from '../popover/PopoverPositioner.vue';
import { injectDatePicker } from './root';
import type { DatePickerPositionerProps, DatePickerPositionerState } from './types';
import type { ElementSlotProps } from '../common/element';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<DatePickerPositionerProps>(), {
  anchor: undefined,
  align: 'start',
});
defineSlots<{
  default?(scope: { state: DatePickerPositionerState }): unknown;
  element?(scope: ElementSlotProps<DatePickerPositionerState>): unknown;
}>();

const picker = injectDatePicker('Positioner');
const attrs = useAttrs();
const part = usePickerPart();

function positionerProps() {
  return mergeProps(attrs, { anchor: props.anchor ?? picker.firstField, align: props.align });
}

defineExpose({ element: part.element });
</script>

<template>
  <PopoverPositioner v-if="$slots.element" :ref="part.setPart" v-bind="positionerProps()">
    <template #element="scope">
      <slot name="element" v-bind="scope" />
    </template>
  </PopoverPositioner>
  <PopoverPositioner v-else :ref="part.setPart" v-bind="positionerProps()">
    <template #default="{ state }">
      <slot :state="state" />
    </template>
  </PopoverPositioner>
</template>
