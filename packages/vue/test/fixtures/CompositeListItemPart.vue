<script lang="ts">
import type { HTMLAttributes } from 'vue';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../../src/internals/types';

export interface CompositeListItemPartState {}

export interface CompositeListItemPartProps
  extends
    VaseUIComponentProps<CompositeListItemPartState>,
    /* @vue-ignore */ WithVaseUIEvent<HTMLAttributes> {
  /** The explicit index of the item. */
  index?: number | undefined;
  /** The label of the item. */
  label?: string | null | undefined;
  /** The metadata that the list publishes with the item. */
  metadata?: Record<string, unknown> | undefined;
}
</script>

<script setup lang="ts">
import { EMPTY_OBJECT } from '../../src/common/empty';
import { useCompositeListItem } from '../../src/internals/composite/list/useCompositeListItem';
import type { ComponentRenderFn, HTMLProps } from '../../src/internals/types';
import { useRenderElement } from '../../src/internals/useRenderElement';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<CompositeListItemPartProps>(), { as: 'div' });

defineSlots<{
  default(props: { state: CompositeListItemPartState }): unknown;
  render: ComponentRenderFn<HTMLProps, CompositeListItemPartState>;
}>();

const state: CompositeListItemPartState = EMPTY_OBJECT;

const { ref, index: itemIndex } = useCompositeListItem({
  index: () => props.index,
  label: () => props.label,
  metadata: () => props.metadata,
});

const { element, elementProps } = useRenderElement('div', props, {
  state,
  ref: [ref],
  props: (attrs) => [{ 'data-index': itemIndex.value }, attrs],
});

defineExpose({ element });
</script>

<template>
  <slot v-if="$slots.render" name="render" :props="elementProps()" :state="state" />
  <component :is="as" v-else v-bind="elementProps()"><slot :state="state" /></component>
</template>
