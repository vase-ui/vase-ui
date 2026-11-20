<script setup lang="ts">
import { computed, mergeProps, useAttrs } from 'vue';
import { useElement, type ElementSlotProps } from '../common/element';
import { injectToolbar, useToolbarItem } from './item';
import type { ToolbarLinkProps, ToolbarLinkState } from './types';

defineOptions({ inheritAttrs: false });

defineProps<ToolbarLinkProps>();
defineSlots<{
  default?(scope: { state: ToolbarLinkState }): unknown;
  element?(scope: ElementSlotProps<ToolbarLinkState>): unknown;
}>();

const toolbar = injectToolbar();
const attrs = useAttrs();
const { element, setElement } = useElement<HTMLElement>();
// A link has no disabled state, also in a disabled toolbar.
const tabindex = useToolbarItem(toolbar, element, { disabled: () => false, focusable: () => true });
const state = computed<ToolbarLinkState>(() => ({ orientation: toolbar.orientation }));

defineExpose({ element });

function elementProps() {
  return mergeProps({ tabindex: tabindex.value, 'data-orientation': toolbar.orientation }, attrs);
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
    <slot :state="state" />
  </component>
  <a v-else v-bind="elementProps()" :ref="setElement">
    <slot :state="state" />
  </a>
</template>
