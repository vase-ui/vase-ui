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
import { computed, shallowRef, type ShallowRef } from 'vue';
import { useCompositeItem } from '../../internals/composite/root/useCompositeRoot';
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

const element: ShallowRef<HTMLElement | null> = shallowRef(null);
const compositeItem = useCompositeItem(element, { metadata: TOOLBAR_LINK_METADATA });

const { elementProps, setRef, usesRenderSlot } = useRenderElement('a', props, {
  elementRef: element,
  state,
  props: (attrs) => [compositeItem.attributes.value, compositeItem.events, attrs],
});

defineExpose({ element });
</script>

<template>
  <slot v-if="usesRenderSlot()" name="render" :props="elementProps()" :state="state" />
  <component :is="as" v-else v-bind="elementProps()" :ref="setRef">
    <slot :state="state" />
  </component>
</template>
