<script setup lang="ts">
import { computed, mergeProps, useAttrs } from 'vue';
import { injectDateTimeField, stateAttributes } from '../common/date-time-field/field';
import { useAttributesAfterMount } from '../common/writeAttributes';
import { useElement, type ElementSlotProps } from '../common/element';
import type { DateFieldLiteralProps, DateFieldLiteralState } from './types';

defineOptions({ inheritAttrs: false });

const props = defineProps<DateFieldLiteralProps>();
defineSlots<{
  element?(scope: ElementSlotProps<DateFieldLiteralState>): unknown;
}>();

const attrs = useAttrs();
const field = injectDateTimeField();
const { element, setElement } = useElement<HTMLElement>();
const state = computed<DateFieldLiteralState>(() => ({ ...field.state, type: props.segment.type }));

useAttributesAfterMount(element, elementProps, () => props.as);

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
  <component :is="as" v-else-if="as" v-bind="elementProps()" :ref="setElement">
    {{ segment.text }}
  </component>
  <span v-else v-bind="elementProps()" :ref="setElement">{{ segment.text }}</span>
</template>
