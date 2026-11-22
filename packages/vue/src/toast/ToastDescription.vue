<script setup lang="ts">
import { computed, mergeProps, onUnmounted, useAttrs, useId } from 'vue';
import { useElement, type ElementSlotProps } from '../common/element';
import { givenId } from '../common/id';
import { useEnterAfterLeave } from '../common/useEnterAfterLeave';
import { hasContent, useHasContent, useHasSlot } from './label';
import { injectToastRoot } from './root';
import type { ToastDescriptionProps, ToastDescriptionState } from './types';

defineOptions({ inheritAttrs: false });

const props = defineProps<ToastDescriptionProps>();
const slots = defineSlots<{
  default?(scope: { state: ToastDescriptionState }): unknown;
  element?(scope: ElementSlotProps<ToastDescriptionState>): unknown;
}>();

const root = injectToastRoot('Description');
const attrs = useAttrs();
const generatedId = useId();
const { element, setElement } = useElement<HTMLElement>();
const elementId = computed(() => givenId(props.id) ?? generatedId);
const hasSlot = useHasSlot();
const label = computed(() => root.toast.description);
const needed = computed(() => hasSlot.value || hasContent(label.value));
const { waiting } = useEnterAfterLeave(() => needed.value, element);
const shown = computed(() => needed.value && !waiting.value);
const filled = useHasContent(element);

// Nuxt removes the call of `onUnmounted` from its server build, with its arguments, so the part
// registers before the call.
const unregister = root.addLabel('description', {
  get id() {
    return elementId.value;
  },
  get shown() {
    return shown.value && (!slots.element || filled.value);
  },
});
onUnmounted(unregister);

const state = computed<ToastDescriptionState>(() => ({ type: root.toast.type }));

function elementProps() {
  return mergeProps({ id: elementId.value, 'data-type': state.value.type }, attrs);
}

defineExpose({ element });
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
    <slot :state="state">
      <component :is="label" v-if="typeof label === 'function'" />
      <template v-else>{{ label }}</template>
    </slot>
  </component>
  <p v-else-if="shown" v-bind="elementProps()" :ref="setElement">
    <slot :state="state">
      <component :is="label" v-if="typeof label === 'function'" />
      <template v-else>{{ label }}</template>
    </slot>
  </p>
</template>
