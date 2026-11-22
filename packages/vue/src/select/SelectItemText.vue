<script setup lang="ts">
import { inject, mergeProps, useAttrs, watch } from 'vue';
import { createError } from '../common/createError';
import { useElement, type ElementSlotProps } from '../common/element';
import { injectSelectRoot, selectItemKey } from './root';
import type { SelectItemTextProps, SelectItemTextState } from './types';

defineOptions({ inheritAttrs: false });

defineProps<SelectItemTextProps>();
defineSlots<{
  default?(scope: { state: SelectItemTextState }): unknown;
  element?(scope: ElementSlotProps<SelectItemTextState>): unknown;
}>();

const context = injectSelectRoot('ItemText');
const item = inject(selectItemKey, null);
if (!item) {
  throw createError(58);
}
const attrs = useAttrs();
const { element, setElement } = useElement<HTMLElement>();
const state: SelectItemTextState = {};

// The popup that covers the trigger puts this text over the text of the value.
watch(
  [() => item.value, element],
  ([itemElement, text], _, onCleanup) => {
    if (!itemElement || !text) return;
    context.itemTexts.set(itemElement, text);
    onCleanup(() => {
      if (context.itemTexts.get(itemElement) === text) context.itemTexts.delete(itemElement);
    });
  },
  { flush: 'sync', immediate: true },
);

function elementProps() {
  return mergeProps({}, attrs);
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
  <div v-else v-bind="elementProps()" :ref="setElement">
    <slot :state="state" />
  </div>
</template>
