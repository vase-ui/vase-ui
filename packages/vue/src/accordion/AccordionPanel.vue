<script setup lang="ts">
import { useAttrs } from 'vue';
import { useCollapsiblePanel } from '../collapsible/panel';
import { useElement } from '../common/element';
import { injectAccordionItem } from './part';
import type { AccordionPanelProps, AccordionPanelState } from './types';

defineOptions({ inheritAttrs: false });

// An absent prop takes the value of the root, so the two Boolean props stay `undefined`.
const props = withDefaults(defineProps<AccordionPanelProps>(), {
  keepMounted: undefined,
  hiddenUntilFound: undefined,
});
defineSlots<{
  default?(scope: { state: AccordionPanelState }): unknown;
  element?(scope: {
    props: Record<string, unknown>;
    elementRef: (target: unknown) => void;
    state: AccordionPanelState;
  }): unknown;
}>();

const item = injectAccordionItem();
const attrs = useAttrs();
const { element, setElement } = useElement<HTMLElement>();
const { shown, elementProps: panelProps } = useCollapsiblePanel(item, {
  element,
  id: () => props.id,
  keepMounted: () => props.keepMounted ?? item.keepMounted,
  hiddenUntilFound: () => props.hiddenUntilFound ?? item.hiddenUntilFound,
  variables: ['--accordion-panel-height', '--accordion-panel-width'],
});

defineExpose({ element });

function elementProps() {
  return panelProps({ role: 'region', 'aria-labelledby': item.triggerId }, attrs);
}
</script>

<template>
  <slot
    v-if="shown && $slots.element"
    name="element"
    :props="elementProps()"
    :elementRef="setElement"
    :state="item.state"
  />
  <component :is="as" v-else-if="shown && as" v-bind="elementProps()" :ref="setElement">
    <slot :state="item.state" />
  </component>
  <div v-else-if="shown" v-bind="elementProps()" :ref="setElement">
    <slot :state="item.state" />
  </div>
</template>
