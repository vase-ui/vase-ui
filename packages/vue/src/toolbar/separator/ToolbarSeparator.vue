<script lang="ts">
import type { Orientation } from '../../internals/types';
import type { SeparatorProps, SeparatorState } from '../../separator';

export interface ToolbarSeparatorState extends SeparatorState {}

export interface ToolbarSeparatorProps extends SeparatorProps {
  /**
   * The orientation of the separator. Defaults to the opposite of the toolbar's
   * orientation, so a horizontal toolbar renders vertical separators.
   */
  orientation?: Orientation | undefined;
}
</script>

<script setup lang="ts">
import { computed, useTemplateRef } from 'vue';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { withoutPropsOf } from '../../internals/withoutPropsOf';
import { Separator } from '../../separator';
import { useToolbarRootContext } from '../root/ToolbarRootContext';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<ToolbarSeparatorProps>(), { as: 'div' });

defineSlots<{
  default(props: { state: ToolbarSeparatorState }): unknown;
  render: ComponentRenderFn<HTMLProps, ToolbarSeparatorState>;
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
  <Separator
    v-if="$slots.render"
    ref="separator"
    v-bind="{ ...withoutPropsOf($attrs, Separator), ...props, orientation: separatorOrientation }"
  >
    <template #render="slotProps">
      <slot name="render" v-bind="slotProps" />
    </template>
  </Separator>
  <Separator
    v-else
    ref="separator"
    v-bind="{ ...withoutPropsOf($attrs, Separator), ...props, orientation: separatorOrientation }"
  >
    <template #default="slotProps">
      <slot v-bind="slotProps" />
    </template>
  </Separator>
</template>
