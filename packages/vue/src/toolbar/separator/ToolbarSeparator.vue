<script lang="ts">
import type { SeparatorProps, SeparatorState } from '../../separator/types';

export interface ToolbarSeparatorState extends SeparatorState {}

export interface ToolbarSeparatorProps extends SeparatorProps {
  /**
   * The orientation of the separator. Defaults to the opposite of the toolbar's
   * orientation, so a horizontal toolbar renders vertical separators.
   */
  orientation?: 'horizontal' | 'vertical';
}
</script>

<script setup lang="ts">
import { computed, useTemplateRef } from 'vue';
import { Separator } from '../../separator';
import { useToolbarRootContext } from '../root/ToolbarRootContext';

const props = defineProps<ToolbarSeparatorProps>();

defineSlots<{
  default?(scope: { state: ToolbarSeparatorState }): unknown;
  element?(scope: {
    props: Record<string, unknown>;
    elementRef: (target: unknown) => void;
    state: ToolbarSeparatorState;
  }): unknown;
}>();

const context = useToolbarRootContext();

const separatorOrientation = computed(
  () => props.orientation ?? (context.orientation.value === 'vertical' ? 'horizontal' : 'vertical'),
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
  <Separator v-else ref="separator" :orientation="separatorOrientation">
    <template #default="scope">
      <slot v-bind="scope" />
    </template>
  </Separator>
</template>
