<script setup lang="ts">
import { mergeProps, useAttrs } from 'vue';
import { useDateTimeFieldSegment } from '../common/date-time-field/segment';
import { useAttributesAfterMount } from '../common/writeAttributes';
import { useElement, type ElementSlotProps } from '../common/element';
import type { TimeFieldSegmentProps, TimeFieldSegmentState } from './types';

defineOptions({ inheritAttrs: false });

const props = defineProps<TimeFieldSegmentProps>();
defineSlots<{
  element?(scope: ElementSlotProps<TimeFieldSegmentState>): unknown;
}>();

const attrs = useAttrs();
const { element, setElement } = useElement<HTMLInputElement>();
const { state, ownProps } = useDateTimeFieldSegment(() => props.segment, element);

useAttributesAfterMount(element, elementProps);

defineExpose({ element });

function elementProps() {
  return mergeProps(ownProps.value, attrs);
}
</script>

<template>
  <slot
    v-if="$slots.element"
    name="element"
    :props="elementProps()"
    :elementRef="setElement"
    :state="state"
  />
  <input v-else v-bind="elementProps()" :ref="setElement" />
</template>
