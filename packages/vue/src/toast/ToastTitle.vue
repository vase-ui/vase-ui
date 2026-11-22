<script setup lang="ts">
import { computed, mergeProps, onUnmounted, useAttrs, useId } from 'vue';
import { useElement, type ElementSlotProps } from '../common/element';
import { givenId } from '../common/id';
import { useEnterAfterLeave } from '../common/useEnterAfterLeave';
import { hasContent, useHasContent, useHasSlot } from './label';
import { injectToastRoot } from './root';
import type { ToastTitleProps, ToastTitleState } from './types';

defineOptions({ inheritAttrs: false });

const props = defineProps<ToastTitleProps>();
const slots = defineSlots<{
  default?(scope: { state: ToastTitleState }): unknown;
  element?(scope: ElementSlotProps<ToastTitleState>): unknown;
}>();

const root = injectToastRoot('Title');
const attrs = useAttrs();
const generatedId = useId();
const { element, setElement } = useElement<HTMLElement>();
const elementId = computed(() => givenId(props.id) ?? generatedId);
const hasSlot = useHasSlot();
const label = computed(() => root.toast.title);
const needed = computed(() => hasSlot.value || hasContent(label.value));
const { waiting } = useEnterAfterLeave(() => needed.value, element);
const shown = computed(() => needed.value && !waiting.value);
const filled = useHasContent(element);

// Nuxt removes the call of `onUnmounted` from its server build, with its arguments, so the part
// registers before the call.
const unregister = root.addLabel('title', {
  get id() {
    return elementId.value;
  },
  get shown() {
    return shown.value && (!slots.element || filled.value);
  },
});
onUnmounted(unregister);

const state = computed<ToastTitleState>(() => ({ type: root.toast.type }));

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
  <h2 v-else-if="shown" v-bind="elementProps()" :ref="setElement">
    <slot :state="state">
      <component :is="label" v-if="typeof label === 'function'" />
      <template v-else>{{ label }}</template>
    </slot>
  </h2>
</template>
