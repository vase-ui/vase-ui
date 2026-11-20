<script setup lang="ts">
import { mergeProps, useAttrs } from 'vue';
import { useElement } from '../common/element';
import { useLiveRegionReady } from '../common/liveRegion';
import { injectComboboxRoot } from './root';
import type { ComboboxStatusProps, ComboboxStatusState } from './types';

defineOptions({ inheritAttrs: false });

defineProps<ComboboxStatusProps>();
defineSlots<{
  default?(scope: { state: ComboboxStatusState }): unknown;
  element?(scope: {
    props: Record<string, unknown>;
    elementRef: (target: unknown) => void;
    state: ComboboxStatusState;
  }): unknown;
}>();

injectComboboxRoot('Status');
const attrs = useAttrs();
const { element, setElement } = useElement<HTMLElement>();
const ready = useLiveRegionReady();
const state: ComboboxStatusState = {};

function elementProps() {
  return mergeProps({ role: 'status', 'aria-live': 'polite', 'aria-atomic': 'true' }, attrs);
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
    <slot v-if="ready" :state="state" />
  </component>
  <div v-else v-bind="elementProps()" :ref="setElement">
    <slot v-if="ready" :state="state" />
  </div>
</template>
