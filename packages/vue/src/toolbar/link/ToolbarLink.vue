<script lang="ts">
import type { AnchorHTMLAttributes } from 'vue';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../../internals/types';
import type { ToolbarRootItemMetadata, ToolbarRootOrientation } from '../root/ToolbarRoot.vue';

export interface ToolbarLinkState {
  /**
   * The component orientation.
   */
  orientation: ToolbarRootOrientation;
}

export interface ToolbarLinkProps
  extends
    VaseUIComponentProps<ToolbarLinkState>,
    /* @vue-ignore */ WithVaseUIEvent<AnchorHTMLAttributes> {}

const TOOLBAR_LINK_METADATA: ToolbarRootItemMetadata = {
  // Links cannot be disabled, but they still occupy a focusable composite item slot.
  disabled: false,
  focusableWhenDisabled: true,
};
</script>

<script setup lang="ts">
import { computed } from 'vue';
import { useCompositeItem } from '../../internals/composite/item/useCompositeItem';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useRenderElement } from '../../internals/useRenderElement';
import { useToolbarRootContext } from '../root/ToolbarRootContext';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<ToolbarLinkProps>(), { as: 'a' });

defineSlots<{
  default(props: { state: ToolbarLinkState }): unknown;
  render: ComponentRenderFn<AnchorHTMLAttributes & Pick<HTMLProps, 'ref'>, ToolbarLinkState>;
}>();

const { orientation } = useToolbarRootContext();

const state = computed<ToolbarLinkState>(() => ({ orientation: orientation.value }));

const { compositeProps, compositeRef } = useCompositeItem({ metadata: TOOLBAR_LINK_METADATA });

const { element, elementProps } = useRenderElement('a', props, {
  state,
  ref: [compositeRef],
  props: (attrs) => [compositeProps.value, attrs],
});

defineExpose({ element });
</script>

<template>
  <slot v-if="$slots.render" name="render" :props="elementProps()" :state="state" />
  <component :is="as" v-else v-bind="elementProps()"><slot :state="state" /></component>
</template>
