<script setup lang="ts">
import { mergeProps, useAttrs } from 'vue';
import { useElement } from '../common/element';
import { injectAccordionItem } from './part';
import type { AccordionHeaderProps, AccordionHeaderState } from './types';

defineOptions({ inheritAttrs: false });

defineProps<AccordionHeaderProps>();
defineSlots<{
  default?(scope: { state: AccordionHeaderState }): unknown;
  element?(scope: {
    props: Record<string, unknown>;
    elementRef: (target: unknown) => void;
    state: AccordionHeaderState;
  }): unknown;
}>();

const item = injectAccordionItem();
const attrs = useAttrs();
const { element, setElement } = useElement<HTMLElement>();

defineExpose({ element });

function elementProps() {
  return mergeProps(
    {
      'data-open': item.open ? '' : undefined,
      'data-disabled': item.disabled ? '' : undefined,
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
    :state="item.state"
  />
  <component :is="as" v-else-if="as" v-bind="elementProps()" :ref="setElement">
    <slot :state="item.state" />
  </component>
  <h3 v-else v-bind="elementProps()" :ref="setElement">
    <slot :state="item.state" />
  </h3>
</template>
