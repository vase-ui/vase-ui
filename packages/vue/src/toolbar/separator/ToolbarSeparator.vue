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

// As in Base UI, this part renders `Separator` and makes no element of its own. The two parts then
// share the role, the attributes and the state.
// The template has one form for `#render` and one for the content. A `v-if` on a slot template
// makes the slots of `Separator` dynamic. Vue then renders `Separator` and each part in its
// content again each time this part renders.
const separatorRef = useTemplateRef('separator');
const element = computed(() => separatorRef.value?.element ?? null);

defineExpose({ element });
</script>

<template>
  <Separator
    v-if="$slots.render"
    ref="separator"
    v-bind="{ ...$attrs, ...props, orientation: separatorOrientation }"
  >
    <template #render="slotProps">
      <slot name="render" v-bind="slotProps" />
    </template>
  </Separator>
  <Separator
    v-else
    ref="separator"
    v-bind="{ ...$attrs, ...props, orientation: separatorOrientation }"
  >
    <template #default="slotProps">
      <slot v-bind="slotProps" />
    </template>
  </Separator>
</template>
