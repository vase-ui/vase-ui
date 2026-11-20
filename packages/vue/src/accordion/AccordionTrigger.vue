<script setup lang="ts">
import { computed, onUnmounted, useAttrs, useId } from 'vue';
import { useCollapsibleTrigger } from '../collapsible/trigger';
import { useElement } from '../common/element';
import { givenId } from '../common/id';
import { injectAccordionItem } from './part';
import type { AccordionTriggerProps, AccordionTriggerState } from './types';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<AccordionTriggerProps>(), { disabled: false });
defineSlots<{
  default?(scope: { state: AccordionTriggerState }): unknown;
  element?(scope: {
    props: Record<string, unknown>;
    elementRef: (target: unknown) => void;
    state: AccordionTriggerState;
  }): unknown;
}>();

const item = injectAccordionItem();
const attrs = useAttrs();
const generatedId = useId();
const { element, setElement } = useElement<HTMLElement>();
const elementId = computed(() => givenId(props.id) ?? generatedId);
const { disabled: isDisabled, elementProps: triggerProps } = useCollapsibleTrigger(item, {
  element,
  disabled: () => props.disabled,
  as: () => props.as,
});
const state = computed<AccordionTriggerState>(() => ({
  ...item.state,
  disabled: isDisabled.value,
}));

// Nuxt removes the call of `onUnmounted` from its server build, with its arguments, so the part
// registers before the call.
const unregister = item.addTrigger({
  get id() {
    return elementId.value;
  },
});
onUnmounted(unregister);

defineExpose({ element });

function elementProps() {
  return triggerProps({ id: elementId.value }, attrs);
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
