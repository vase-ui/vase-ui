<script setup lang="ts">
import { computed, mergeProps, useAttrs } from 'vue';
import { useElement, type ElementSlotProps } from '../common/element';
import type { SeparatorProps, SeparatorState } from './types';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<SeparatorProps>(), { orientation: 'horizontal' });
defineSlots<{
  /** Content, such as a glyph between two groups. Assistive technology does not read it. */
  default?(scope: { state: SeparatorState }): unknown;
  element?(scope: ElementSlotProps<SeparatorState>): unknown;
}>();

const attrs = useAttrs();
const { element, setElement } = useElement<HTMLDivElement>();
const state = computed<SeparatorState>(() => ({ orientation: props.orientation }));

defineExpose({ element });

function elementProps() {
  return mergeProps({ role: 'separator', 'aria-orientation': props.orientation }, attrs);
}
</script>

<!-- A server writes no content in a void element, such as an `<hr>` in `as`, and the hydration
reads an empty slot as content. -->
<template>
  <slot
    v-if="$slots.element"
    name="element"
    :props="elementProps()"
    :elementRef="setElement"
    :state="state"
  />
  <component :is="as" v-else-if="as && $slots.default" v-bind="elementProps()" :ref="setElement">
    <slot :state="state" />
  </component>
  <component :is="as" v-else-if="as" v-bind="elementProps()" :ref="setElement" />
  <div v-else v-bind="elementProps()" :ref="setElement">
    <slot :state="state" />
  </div>
</template>
