<script lang="ts">
import type { HTMLAttributes, Ref } from 'vue';
import type { ModifierKey } from '../../src/internals/composite/composite';
import type { CompositeMetadata } from '../../src/internals/composite/list/useCompositeList';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../../src/internals/types';

export interface CompositeRootPartState {}

export interface CompositeRootPartProps
  extends
    VaseUIComponentProps<CompositeRootPartState>,
    /* @vue-ignore */ WithVaseUIEvent<HTMLAttributes> {
  /** The direction of the arrow keys that move the highlight. */
  orientation?: 'horizontal' | 'vertical' | 'both' | undefined;
  /** Whether the highlight goes from one end of the list to the other end. */
  loopFocus?: boolean | undefined;
  /** Called when the highlight goes from one end of the list to the other end. */
  onLoop?:
    | ((
        event: KeyboardEvent,
        prevIndex: number,
        nextIndex: number,
        elementsRef: Readonly<Ref<readonly (HTMLElement | null)[]>>,
      ) => number)
    | undefined;
  /** The highlighted index, when the root is controlled. */
  highlightedIndex?: number | undefined;
  /** Called with the new index when the highlighted index changes. */
  onHighlightedIndexChange?: ((index: number) => void) | undefined;
  /** Whether the Home and End keys move the highlight. */
  enableHomeAndEndKeys?: boolean | undefined;
  /** Whether a key that moves the highlight stops its propagation. */
  stopEventPropagation?: boolean | undefined;
  /** The indexes of the items that the root treats as disabled. */
  disabledIndices?: number[] | undefined;
  /** The modifier keys that can be pressed while the arrow keys still move the highlight. */
  modifierKeys?: ModifierKey[] | undefined;
  /** Whether an item gets focus when the pointer moves over it. */
  highlightItemOnHover?: boolean | undefined;
  /** Called with the new map when the list publishes it. */
  onMapChange?: ((newMap: Map<Element, CompositeMetadata<any>>) => void) | undefined;
}
</script>

<script setup lang="ts">
import { EMPTY_OBJECT } from '../../src/common/empty';
import { useCompositeRoot } from '../../src/internals/composite/root/useCompositeRoot';
import type { ComponentRenderFn, HTMLProps } from '../../src/internals/types';
import { useRenderElement } from '../../src/internals/useRenderElement';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<CompositeRootPartProps>(), {
  as: 'div',
  loopFocus: undefined,
  highlightedIndex: undefined,
  enableHomeAndEndKeys: undefined,
  stopEventPropagation: undefined,
  highlightItemOnHover: undefined,
});

defineSlots<{
  default(props: { state: CompositeRootPartState }): unknown;
  render: ComponentRenderFn<HTMLProps, CompositeRootPartState>;
}>();

const state: CompositeRootPartState = EMPTY_OBJECT;

const {
  props: compositeProps,
  rootRef,
  highlightedIndex: rootHighlightedIndex,
} = useCompositeRoot({
  orientation: () => props.orientation,
  loopFocus: () => props.loopFocus,
  onLoop: (event, prev, next, elements) =>
    props.onLoop ? props.onLoop(event, prev, next, elements) : next,
  highlightedIndex: () => props.highlightedIndex,
  onHighlightedIndexChange: (index) => props.onHighlightedIndexChange?.(index),
  enableHomeAndEndKeys: () => props.enableHomeAndEndKeys,
  stopEventPropagation: () => props.stopEventPropagation,
  disabledIndices: () => props.disabledIndices,
  modifierKeys: () => props.modifierKeys,
  highlightItemOnHover: () => props.highlightItemOnHover,
  onMapChange: (newMap) => props.onMapChange?.(newMap),
});

const { element, elementProps } = useRenderElement('div', props, {
  state,
  ref: [rootRef],
  props: (attrs) => [
    compositeProps,
    { 'data-highlighted-index': rootHighlightedIndex.value },
    attrs,
  ],
});

defineExpose({ element });
</script>

<template>
  <slot v-if="$slots.render" name="render" :props="elementProps()" :state="state" />
  <component :is="as" v-else v-bind="elementProps()"><slot :state="state" /></component>
</template>
