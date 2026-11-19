<script lang="ts">
import type { HTMLAttributes } from 'vue';
import type {
  ComponentRenderFn,
  HTMLProps,
  VaseUIComponentProps,
  WithVaseUIEvent,
} from '../../src/internals/types';
import type { UseAnchorPositioningSharedParameters } from '../../src/internals/useAnchorPositioning';
import type { PopupPositionerState } from '../../src/utils/popups/usePopupPositioner';

export interface PopupPositionerPartProps
  extends
    VaseUIComponentProps<PopupPositionerState>,
    UseAnchorPositioningSharedParameters,
    /* @vue-ignore */ WithVaseUIEvent<HTMLAttributes> {
  /**
   * Whether the part stays in the DOM while the popup is not mounted.
   * @default false
   */
  keepMounted?: boolean | undefined;
}
</script>

<script setup lang="ts">
import { inject, provide } from 'vue';
import { usePopupPositioner } from '../../src/utils/popups/usePopupPositioner';
import { provideFloatingNode, useFloatingNodeId } from '../../src/utils/popups/tree/FloatingTree';
import { PopupFixtureContext, PopupFixturePositionerContext } from './PopupFixture';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<PopupPositionerPartProps>(), {
  as: 'div',
  keepMounted: false,
});

defineSlots<{
  default(props: { state: PopupPositionerState }): unknown;
  render: ComponentRenderFn<HTMLProps, PopupPositionerState>;
}>();

const store = inject(PopupFixtureContext);
if (store === undefined) {
  throw new Error('Vase UI: <PopupPositionerPart> must be inside <PopupRootPart>.');
}

// The node comes first, because the positioning context of the part writes to it.
const nodeId = useFloatingNodeId();
provideFloatingNode(nodeId);

const { element, elementProps, setRef, usesRenderSlot, state, positioning } = usePopupPositioner(
  props,
  store,
  {
    keepMounted: () => props.keepMounted,
    positioning: { nodeId },
  },
);

provide(PopupFixturePositionerContext, { side: positioning.side });

defineExpose({ element, update: positioning.update });
</script>

<template>
  <slot v-if="usesRenderSlot()" name="render" :props="elementProps()" :state="state" />
  <component :is="as" v-else v-bind="elementProps()" :ref="setRef">
    <slot :state="state" />
  </component>
</template>
