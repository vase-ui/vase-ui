<script lang="ts">
import type { HTMLAttributes } from 'vue';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../../internals/types';
import type {
  Align,
  Side,
  UseAnchorPositioningSharedParameters,
} from '../../internals/useAnchorPositioning';

export interface PreviewCardPositionerState {
  /**
   * Whether the preview card is currently open.
   */
  open: boolean;
  /**
   * The side of the anchor the component is placed on.
   */
  side: Side;
  /**
   * The alignment of the component relative to the anchor.
   */
  align: Align;
  /**
   * Whether the anchor element is hidden.
   */
  anchorHidden: boolean;
  /**
   * Whether transitions should be skipped.
   */
  instant: 'dismiss' | 'focus' | undefined;
}

export interface PreviewCardPositionerProps
  extends
    VaseUIComponentProps<PreviewCardPositionerState>,
    UseAnchorPositioningSharedParameters,
    /* @vue-ignore */ WithVaseUIEvent<HTMLAttributes> {}
</script>

<script setup lang="ts">
import { provide, watch } from 'vue';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import {
  createInlineMiddleware,
  PreviewCardPositionerContext,
} from './PreviewCardPositionerContext';
import { usePopupPositioner } from '../../utils/popups/usePopupPositioner';
import { provideFloatingNode, useFloatingNodeId } from '../../utils/popups/tree/FloatingTree';
import { usePreviewCardPortalContext } from '../portal/PreviewCardPortalContext';
import { usePreviewCardRootContext } from '../root/PreviewCardContext';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<PreviewCardPositionerProps>(), {
  as: 'div',
  disableAnchorTracking: false,
  align: 'center',
  alignOffset: 0,
  side: 'bottom',
  sideOffset: 0,
  arrowPadding: 5,
  collisionBoundary: 'clipping-ancestors',
  collisionPadding: 5,
  sticky: false,
  positionMethod: 'absolute',
});

defineSlots<{
  default(props: { state: PreviewCardPositionerState }): unknown;
  render: ComponentRenderFn<HTMLProps, PreviewCardPositionerState>;
}>();

const { store } = usePreviewCardRootContext();
const keepMounted = usePreviewCardPortalContext();
const nodeId = useFloatingNodeId();

const { element, elementProps, setRef, usesRenderSlot, state, positioning, open, mounted } =
  usePopupPositioner<PreviewCardPositionerState>(props, store, {
    keepMounted,
    positioning: {
      nodeId,
      inline: createInlineMiddleware(store.context.inlineRectCoordsRef),
    },
  });

// An open card can select a different line while its positioner stays mounted.
watch(
  [open, mounted],
  ([isOpen, isMounted]) => {
    if (isOpen && isMounted) positioning.update();
  },
  { flush: 'post' },
);

provide(PreviewCardPositionerContext, positioning);
provideFloatingNode(nodeId);

defineExpose({ element });
</script>

<template>
  <slot v-if="usesRenderSlot()" name="render" :props="elementProps()" :state="state" />
  <component :is="as" v-else v-bind="elementProps()" :ref="setRef">
    <slot :state="state" />
  </component>
</template>
