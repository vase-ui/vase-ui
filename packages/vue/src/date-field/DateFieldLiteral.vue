<script setup lang="ts">
import { computed, mergeProps, onMounted, useAttrs } from 'vue';
import { injectDateTimeField, stateAttributes } from '../common/date-time-field/field';
import { writeAttributes } from '../common/date-time-field/segment';
import { useElement } from '../common/element';
import type { DateFieldLiteralProps, DateFieldLiteralState } from './types';

defineOptions({ inheritAttrs: false });

const props = defineProps<DateFieldLiteralProps>();
defineSlots<{
  element?(scope: {
    props: Record<string, unknown>;
    elementRef: (target: unknown) => void;
    state: DateFieldLiteralState;
  }): unknown;
}>();

const attrs = useAttrs();
const field = injectDateTimeField();
const { element, setElement } = useElement<HTMLElement>();
const state = computed<DateFieldLiteralState>(() => ({ ...field.state, type: props.segment.type }));

onMounted(() => {
  if (element.value) writeAttributes(element.value, elementProps());
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
