<script setup lang="ts">
import { computed, mergeProps, useAttrs } from 'vue';
import { usePickerPart } from '../common/picker/popup';
import PopoverPositioner from '../popover/PopoverPositioner.vue';
import { injectDateRangePicker } from './root';
import type { DateRangePickerPositionerProps, DateRangePickerPositionerState } from './types';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<DateRangePickerPositionerProps>(), {
  anchor: undefined,
  align: 'start',
});
defineSlots<{
  default?(scope: { state: DateRangePickerPositionerState }): unknown;
  element?(scope: {
    props: Record<string, unknown>;
    elementRef: (target: unknown) => void;
    state: DateRangePickerPositionerState;
  }): unknown;
}>();

const picker = injectDateRangePicker('Positioner');
const attrs = useAttrs();
const part = usePickerPart();

// The box around the two fields, so that `align` lines the popup up with both. With one field, the
// popup is at that field, and with none at the trigger.
const fieldsAnchor = computed(() => {
  const [start, end] = picker.ends;
  if (!start || !end) return start ?? end;
  return {
    contextElement: start,
    getBoundingClientRect() {
      const a = start.getBoundingClientRect();
      const b = end.getBoundingClientRect();
      return DOMRect.fromRect({
        x: Math.min(a.left, b.left),
        y: Math.min(a.top, b.top),
        width: Math.max(a.right, b.right) - Math.min(a.left, b.left),
        height: Math.max(a.bottom, b.bottom) - Math.min(a.top, b.top),
      });
    },
  };
});

function positionerProps() {
  return mergeProps(attrs, { anchor: props.anchor ?? fieldsAnchor.value, align: props.align });
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
