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
import { onMounted, provide, watch } from 'vue';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { createInlineMiddleware } from '../../utils/popups/inlineRect';
import { usePopupPositioner } from '../../utils/popups/popupPositioner';
import { provideFloatingNode, useFloatingNodeId } from '../../utils/popups/tree/FloatingTree';
import { usePreviewCardPortalContext } from '../portal/PreviewCardPortalContext';
import { usePreviewCardRootContext } from '../root/PreviewCardContext';
import { PreviewCardPositionerContext } from './PreviewCardPositionerContext';

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

const store = usePreviewCardRootContext();
const keepMounted = usePreviewCardPortalContext();
const nodeId = useFloatingNodeId();

const { element, elementProps, state, positioning, open, mounted } =
  usePopupPositioner<PreviewCardPositionerState>(store, props, {
    keepMounted,
    positioning: {
      nodeId,
      inline: createInlineMiddleware(store.context.inlineRectCoordsRef),
    },
  });

// The store can take the coordinates of another line while the card is still mounted, so each
// open positions the card again.
function updatePosition() {
  if (open.value && mounted.value) {
    positioning.update();
  }
}
onMounted(updatePosition);
watch([open, mounted], updatePosition, { flush: 'post' });

provide(PreviewCardPositionerContext, positioning);
provideFloatingNode(nodeId);

defineExpose({ element });
</script>

<template>
  <slot v-if="$slots.render" name="render" :props="elementProps()" :state="state" />
  <component :is="as" v-else v-bind="elementProps()"><slot :state="state" /></component>
</template>
