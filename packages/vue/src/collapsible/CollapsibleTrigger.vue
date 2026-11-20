<script setup lang="ts">
import { computed, useAttrs } from 'vue';
import { useElement } from '../common/element';
import { injectCollapsible } from './part';
import { useCollapsibleTrigger } from './trigger';
import type { CollapsibleTriggerProps, CollapsibleTriggerState } from './types';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<CollapsibleTriggerProps>(), { disabled: false });
defineSlots<{
  default?(scope: { state: CollapsibleTriggerState }): unknown;
  element?(scope: {
    props: Record<string, unknown>;
    elementRef: (target: unknown) => void;
    state: CollapsibleTriggerState;
  }): unknown;
}>();

const collapsible = injectCollapsible();
const attrs = useAttrs();
const { element, setElement } = useElement<HTMLElement>();
const { disabled, elementProps: triggerProps } = useCollapsibleTrigger(collapsible, {
  element,
  disabled: () => props.disabled,
  as: () => props.as,
});
const state = computed<CollapsibleTriggerState>(() => ({
  open: collapsible.open,
  disabled: disabled.value,
}));

defineExpose({ element });

function elementProps() {
  return triggerProps({}, attrs);
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
  <button v-else v-bind="elementProps()" :ref="setElement">
    <slot :state="state" />
  </button>
</template>
