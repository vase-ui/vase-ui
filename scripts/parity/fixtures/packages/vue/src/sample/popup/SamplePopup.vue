<script lang="ts">
import type { Component, HTMLAttributes, StyleValue } from 'vue';

export interface SamplePopupState {
  open: boolean;
  side: 'top' | 'bottom';
  disabled: boolean;
}

export interface SamplePopupProps extends /* @vue-ignore */ HTMLAttributes {
  /** The tag or component to render. */
  as?: string | Component | undefined;
  /** The name of the popup. */
  name: string;
  /** Which side of the trigger the popup uses. */
  side?: 'top' | 'bottom' | undefined;
  /** Whether to keep the popup in the DOM while the sample is closed. */
  keepMounted?: boolean | undefined;
  /** Whether the popup is disabled. */
  disabled?: boolean | undefined;
  /** A class that depends on the state. */
  stateClass?: ((state: SamplePopupState) => string | undefined) | undefined;
  /** A style that depends on the state. */
  stateStyle?: ((state: SamplePopupState) => StyleValue | undefined) | undefined;
}
</script>

<script setup lang="ts">
import { computed, mergeProps, ref, useAttrs } from 'vue';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<SamplePopupProps>(), {
  as: 'div',
  side: 'bottom',
  keepMounted: false,
  disabled: false,
  stateClass: undefined,
  stateStyle: undefined,
});

defineSlots<{
  default(props: { state: SamplePopupState }): unknown;
  render(props: { props: Record<string, unknown>; state: SamplePopupState }): unknown;
}>();

const attrs = useAttrs();
const element = ref<Element | null>(null);
const state = computed<SamplePopupState>(() => ({
  open: true,
  side: props.side,
  disabled: props.disabled,
}));

function setElement(value: unknown) {
  const node = value as { nodeType?: number } | null;
  element.value = node && node.nodeType === 1 ? (node as Element) : null;
}

function elementProps() {
  return mergeProps(attrs, {
    ref: setElement,
    'data-open': '',
    'data-side': props.side,
    class: props.stateClass?.(state.value),
    style: props.stateStyle?.(state.value),
  });
}

defineExpose({ element });
</script>

<template>
  <slot v-if="$slots.render" name="render" :props="elementProps()" :state="state" />
  <component :is="as" v-else v-bind="elementProps()"><slot :state="state" /></component>
</template>
