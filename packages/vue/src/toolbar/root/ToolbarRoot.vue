<script lang="ts">
import type { HTMLAttributes } from 'vue';
import type {
  Orientation as BaseOrientation,
  VaseUIComponentProps,
  WithVaseUIEvent,
} from '../../internals/types';

export interface ToolbarRootItemMetadata {
  disabled: boolean;
  focusableWhenDisabled: boolean;
}

export type ToolbarRootOrientation = BaseOrientation;

export interface ToolbarRootState {
  /**
   * Whether the component is disabled.
   */
  disabled: boolean;
  /**
   * The component orientation.
   */
  orientation: ToolbarRootOrientation;
}

export interface ToolbarRootProps
  extends
    VaseUIComponentProps<ToolbarRootState>,
    /* @vue-ignore */ WithVaseUIEvent<HTMLAttributes> {
  disabled?: boolean | undefined;
  /**
   * The orientation of the toolbar.
   * @default 'horizontal'
   */
  orientation?: ToolbarRootOrientation | undefined;
  /**
   * If `true`, using keyboard navigation will wrap focus to the other end of the toolbar once the end is reached.
   *
   * @default true
   */
  loopFocus?: boolean | undefined;
}
</script>

<script setup lang="ts">
import { computed, provide, shallowRef } from 'vue';
import type { CompositeMetadata } from '../../internals/composite/list/useCompositeList';
import { useCompositeRoot } from '../../internals/composite/root/useCompositeRoot';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useRenderElement } from '../../internals/useRenderElement';
import { ToolbarRootContext } from './ToolbarRootContext';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<ToolbarRootProps>(), {
  as: 'div',
  disabled: false,
  orientation: 'horizontal',
  loopFocus: true,
});

defineSlots<{
  default(props: { state: ToolbarRootState }): unknown;
  render: ComponentRenderFn<HTMLProps, ToolbarRootState>;
}>();

const itemMap = shallowRef<ReadonlyMap<Element, CompositeMetadata<ToolbarRootItemMetadata>>>(
  new Map(),
);

const disabledIndices = computed(() => {
  const output: number[] = [];
  for (const itemMetadata of itemMap.value.values()) {
    // Only items that are disabled and not focusable when disabled
    // are removed from roving focus.
    if (itemMetadata.disabled && !itemMetadata.focusableWhenDisabled) {
      output.push(itemMetadata.index);
    }
  }
  return output;
});

provide(ToolbarRootContext, {
  disabled: computed(() => props.disabled),
  orientation: computed(() => props.orientation),
});

const state = computed<ToolbarRootState>(() => ({
  disabled: props.disabled,
  orientation: props.orientation,
}));

const { props: compositeProps, rootRef } = useCompositeRoot<ToolbarRootItemMetadata>({
  disabledIndices,
  loopFocus: () => props.loopFocus,
  onMapChange(newMap) {
    itemMap.value = newMap;
  },
  orientation: () => props.orientation,
});

const { element, elementProps } = useRenderElement('div', props, {
  state,
  ref: [rootRef],
  props: (attrs) => [
    compositeProps,
    { 'aria-orientation': props.orientation, role: 'toolbar' },
    attrs,
  ],
});

defineExpose({ element });
</script>

<template>
  <slot v-if="$slots.render" name="render" :props="elementProps()" :state="state" />
  <component :is="as" v-else v-bind="elementProps()"><slot :state="state" /></component>
</template>
