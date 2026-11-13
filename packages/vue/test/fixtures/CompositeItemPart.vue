<script lang="ts">
import type { HTMLAttributes } from 'vue';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../../src/internals/types';

export interface CompositeItemPartState {}

export interface CompositeItemPartProps
  extends
    VaseUIComponentProps<CompositeItemPartState>,
    /* @vue-ignore */ WithVaseUIEvent<HTMLAttributes> {
  /** The metadata that the list publishes with the item. */
  metadata?: Record<string, unknown> | undefined;
  /** Whether the item is active. The part does not write `data-composite-item-active`. */
  active?: boolean | undefined;
  /** Whether the item cannot hold the first tab stop. The part does not write a disabled attribute. */
  disabled?: boolean | undefined;
}
</script>

<script setup lang="ts">
import { EMPTY_OBJECT } from '../../src/common/empty';
import { useCompositeItem } from '../../src/internals/composite/item/useCompositeItem';
import type { ComponentRenderFn, HTMLProps } from '../../src/internals/types';
import { useRenderElement } from '../../src/internals/useRenderElement';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<CompositeItemPartProps>(), { as: 'div' });

defineSlots<{
  default(props: { state: CompositeItemPartState }): unknown;
  render: ComponentRenderFn<HTMLProps, CompositeItemPartState>;
}>();

const state: CompositeItemPartState = EMPTY_OBJECT;

const { compositeProps, compositeRef } = useCompositeItem({
  metadata: () => props.metadata,
  active: () => props.active,
  disabled: () => props.disabled,
});

const { element, elementProps } = useRenderElement('div', props, {
  state,
  // The composite ref is first. When two items share one element, the outer item registers last
  // and owns the entry.
  ref: [compositeRef],
  props: (attrs) => [compositeProps.value, attrs],
});

defineExpose({ element });
</script>

<template>
  <slot v-if="$slots.render" name="render" :props="elementProps()" :state="state" />
  <component :is="as" v-else v-bind="elementProps()"><slot :state="state" /></component>
</template>
