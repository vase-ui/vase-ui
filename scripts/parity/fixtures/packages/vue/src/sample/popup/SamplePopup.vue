<script lang="ts">
import type { Component, HTMLAttributes } from 'vue';

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
}
</script>

<script setup lang="ts">
import { computed, mergeProps, ref, useAttrs } from 'vue';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<SamplePopupProps>(), {
  as: undefined,
  side: 'bottom',
  keepMounted: false,
  disabled: false,
});

defineSlots<{
  default(props: { state: SamplePopupState }): unknown;
  element?(scope: {
    props: Record<string, unknown>;
    elementRef: (element: unknown) => void;
    state: SamplePopupState;
  }): unknown;
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
    'data-open': '',
    'data-side': props.side,
  });
}

defineExpose({ element });
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
  <div v-else v-bind="elementProps()" :ref="setElement"><slot :state="state" /></div>
</template>
