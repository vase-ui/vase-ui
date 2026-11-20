<script setup lang="ts">
import { computed, mergeProps, onMounted, useAttrs, useSlots } from 'vue';
import { injectDateTimeField, stateAttributes } from '../common/date-time-field/field';
import { writeAttributes } from '../common/writeAttributes';
import { useElement } from '../common/element';
import type { TimeFieldLiteralProps, TimeFieldLiteralState } from './types';

defineOptions({ inheritAttrs: false });

const props = defineProps<TimeFieldLiteralProps>();
defineSlots<{
  element?(scope: {
    props: Record<string, unknown>;
    elementRef: (target: unknown) => void;
    state: TimeFieldLiteralState;
  }): unknown;
}>();

const attrs = useAttrs();
const slots = useSlots();
const field = injectDateTimeField();
const { element, setElement } = useElement<HTMLElement>();
const state = computed<TimeFieldLiteralState>(() => ({ ...field.state, type: props.segment.type }));

// The element of the `element` slot can have attributes of the developer that win over those of
// the part, so the part writes only to its own element.
onMounted(() => {
  if (element.value && !slots.element) writeAttributes(element.value, elementProps());
});

defineExpose({ element });

function elementProps() {
  return mergeProps(
    {
      // An era and a zone name say something that a screen reader reads.
      'aria-hidden': props.segment.type === 'literal' ? 'true' : undefined,
      ...stateAttributes(field.state),
      'data-type': props.segment.type,
    },
    attrs,
  );
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
  <span v-else v-bind="elementProps()" :ref="setElement">{{ segment.text }}</span>
</template>
