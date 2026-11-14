<script lang="ts">
import type { HTMLAttributes } from 'vue';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../../internals/types';
import type {
  Align,
  Side,
  UseAnchorPositioningSharedParameters,
} from '../../internals/useAnchorPositioning';

export interface PopoverPositionerState {
  /**
   * Whether the popover is currently open.
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
   * Whether CSS transitions should be disabled.
   */
  instant: string | undefined;
}

export interface PopoverPositionerProps
  extends
    VaseUIComponentProps<PopoverPositionerState>,
    UseAnchorPositioningSharedParameters,
    /* @vue-ignore */ WithVaseUIEvent<HTMLAttributes> {}
</script>

<script setup lang="ts">
import { provide } from 'vue';
import { REASONS } from '../../internals/reasons';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { usePopupPositioner } from '../../utils/popups/popupPositioner';
import { provideFloatingNode, useFloatingNodeId } from '../../utils/popups/tree/FloatingTree';
import { useAnchoredPopupScrollLock } from '../../utils/popups/useAnchoredPopupScrollLock';
import { usePopoverPortalContext } from '../portal/PopoverPortalContext';
import { usePopoverRootContext } from '../root/PopoverRootContext';
import { PopoverPositionerContext } from './PopoverPositionerContext';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<PopoverPositionerProps>(), {
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
  default(props: { state: PopoverPositionerState }): unknown;
  render: ComponentRenderFn<HTMLProps, PopoverPositionerState>;
}>();

const store = usePopoverRootContext();
const keepMounted = usePopoverPortalContext();
const nodeId = useFloatingNodeId();

const { element, elementProps, state, positioning, open } =
  usePopupPositioner<PopoverPositionerState>(store, props, {
    keepMounted,
    positioning: { nodeId },
  });

provide(PopoverPositionerContext, positioning);
provideFloatingNode(nodeId);

useAnchoredPopupScrollLock(
  () =>
    open.value &&
    store.select('modal') === true &&
    store.select('openChangeReason') !== REASONS.triggerHover,
  () => store.select('openMethod') === 'touch',
  () => store.select('positionerElement'),
  () => store.select('activeTriggerElement'),
);

defineExpose({ element });
</script>

<template>
  <slot v-if="$slots.render" name="render" :props="elementProps()" :state="state" />
  <component :is="as" v-else v-bind="elementProps()"><slot :state="state" /></component>
</template>
