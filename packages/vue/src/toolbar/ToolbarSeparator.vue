<script setup lang="ts">
import { computed, useTemplateRef } from 'vue';
import { Separator } from '../separator';
import { injectToolbar } from './item';
import type { ToolbarSeparatorProps, ToolbarSeparatorState } from './types';

const props = defineProps<ToolbarSeparatorProps>();
defineSlots<{
  default?(scope: { state: ToolbarSeparatorState }): unknown;
  element?(scope: {
    props: Record<string, unknown>;
    elementRef: (target: unknown) => void;
    state: ToolbarSeparatorState;
  }): unknown;
}>();

const toolbar = injectToolbar();
const separatorOrientation = computed(
  () => props.orientation ?? (toolbar.orientation === 'vertical' ? 'horizontal' : 'vertical'),
);

// Separate slot outlets keep the child slots stable across updates.
const separatorRef = useTemplateRef('separator');
const element = computed(() => separatorRef.value?.element ?? null);

defineExpose({ element });
</script>

<template>
  <Separator v-if="$slots.element" ref="separator" :orientation="separatorOrientation">
    <template #element="scope">
      <slot name="element" v-bind="scope" />
    </template>
  </Separator>
  <Separator
    v-else-if="$slots.default"
    ref="separator"
    :as="as"
    :orientation="separatorOrientation"
  >
    <template #default="scope">
      <slot v-bind="scope" />
    </template>
  </Separator>
  <Separator v-else ref="separator" :as="as" :orientation="separatorOrientation" />
</template>
