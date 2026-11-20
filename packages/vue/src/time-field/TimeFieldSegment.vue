<script setup lang="ts">
import { mergeProps, onMounted, useAttrs, useSlots } from 'vue';
import { useDateTimeFieldSegment } from '../common/date-time-field/segment';
import { writeAttributes } from '../common/writeAttributes';
import { useElement } from '../common/element';
import type { TimeFieldSegmentProps, TimeFieldSegmentState } from './types';

defineOptions({ inheritAttrs: false });

const props = defineProps<TimeFieldSegmentProps>();
defineSlots<{
  element?(scope: {
    props: Record<string, unknown>;
    elementRef: (target: unknown) => void;
    state: TimeFieldSegmentState;
  }): unknown;
}>();

const attrs = useAttrs();
const slots = useSlots();
const { element, setElement } = useElement<HTMLInputElement>();
const { state, ownProps } = useDateTimeFieldSegment(() => props.segment, element);

// The element of the `element` slot can have attributes of the developer that win over those of
// the part, so the part writes only to its own element.
onMounted(() => {
  if (element.value && !slots.element) writeAttributes(element.value, elementProps());
});

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
