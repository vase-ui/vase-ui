<script setup lang="ts">
import { computed, useAttrs } from 'vue';
import { useElement, type ElementSlotProps } from '../common/element';
import { useCollapsiblePanel } from './panel';
import { injectCollapsible } from './part';
import type { CollapsiblePanelProps, CollapsiblePanelState } from './types';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<CollapsiblePanelProps>(), {
  keepMounted: false,
  hiddenUntilFound: false,
});
defineSlots<{
  default?(scope: { state: CollapsiblePanelState }): unknown;
  element?(scope: ElementSlotProps<CollapsiblePanelState>): unknown;
}>();

const collapsible = injectCollapsible();
const attrs = useAttrs();
const { element, setElement } = useElement<HTMLElement>();
const { shown, elementProps: panelProps } = useCollapsiblePanel(collapsible, {
  element,
  id: () => props.id,
  keepMounted: () => props.keepMounted,
  hiddenUntilFound: () => props.hiddenUntilFound,
  variables: ['--collapsible-panel-height', '--collapsible-panel-width'],
});
const state = computed<CollapsiblePanelState>(() => ({
  open: collapsible.open,
  disabled: collapsible.disabled,
}));

defineExpose({ element });

function elementProps() {
  return panelProps({}, attrs);
}
</script>

<template>
  <slot
    v-if="shown && $slots.element"
    name="element"
    :props="elementProps()"
    :elementRef="setElement"
    :state="state"
  />
  <component :is="as" v-else-if="shown && as" v-bind="elementProps()" :ref="setElement">
    <slot :state="state" />
  </component>
  <div v-else-if="shown" v-bind="elementProps()" :ref="setElement">
    <slot :state="state" />
  </div>
</template>
