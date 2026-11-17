<script lang="ts">
import type { HTMLAttributes } from 'vue';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../../internals/types';

export interface ComboboxEmptyState {}

export interface ComboboxEmptyProps
  extends
    VaseUIComponentProps<ComboboxEmptyState>,
    /* @vue-ignore */ WithVaseUIEvent<HTMLAttributes> {}
</script>

<script setup lang="ts">
import type { Component } from 'vue';
import { EMPTY_OBJECT } from '../../common/empty';
import type { HTMLProps } from '../../internals/types';
import { useInitialLiveRegionTextMutation } from '../../internals/useInitialLiveRegionTextMutation';
import { useRenderElement } from '../../internals/useRenderElement';
import { useComboboxRootContext } from '../root/ComboboxRootContext';
import ComboboxEmptyChildren from './ComboboxEmptyChildren.vue';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<ComboboxEmptyProps>(), { as: 'div' });

defineSlots<{
  default(props: { state: ComboboxEmptyState }): unknown;
  render(props: { props: HTMLProps; state: ComboboxEmptyState; children: Component }): unknown;
}>();

const store = useComboboxRootContext();
const emptyRef = useInitialLiveRegionTextMutation<HTMLElement>();

// A template can mount the part that replaces this part before it unmounts this part. The part then
// clears the element of the root only when the root holds its own element.
let ownElement: HTMLElement | null = null;
function setEmptyElement(element: HTMLElement | null) {
  if (element !== null || store.context.emptyRef.value === ownElement) {
    store.context.emptyRef.value = element as HTMLDivElement | null;
  }
  ownElement = element;
}

const state: ComboboxEmptyState = EMPTY_OBJECT;

const { element, elementProps, setRef, usesRenderSlot } = useRenderElement('div', props, {
  state,
  ref: [setEmptyElement, emptyRef],
  props: (attrs) => [{ role: 'status', 'aria-live': 'polite', 'aria-atomic': true }, attrs],
  children: true,
});

defineExpose({ element });
</script>

<!-- prettier-ignore -->
<template>
  <slot v-if="usesRenderSlot()" name="render" :props="elementProps()" :state="state" :children="ComboboxEmptyChildren" />
  <component :is="as" v-else v-bind="elementProps()" :ref="setRef">
    <ComboboxEmptyChildren><slot :state="state" /></ComboboxEmptyChildren>
  </component>
</template>
