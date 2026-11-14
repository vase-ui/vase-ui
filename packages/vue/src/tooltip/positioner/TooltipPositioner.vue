<script lang="ts">
import type { HTMLAttributes } from 'vue';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../../internals/types';
import type {
  Align,
  Side,
  UseAnchorPositioningSharedParameters,
} from '../../internals/useAnchorPositioning';

export interface TooltipPositionerState {
  /**
   * Whether the tooltip is currently open.
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

export interface TooltipPositionerProps
  extends
    VaseUIComponentProps<TooltipPositionerState>,
    Omit<UseAnchorPositioningSharedParameters, 'side'>,
    /* @vue-ignore */ WithVaseUIEvent<HTMLAttributes> {
  /**
   * Which side of the anchor element to align the popup against.
   * May automatically change to avoid collisions.
   * @default 'top'
   */
  side?: Side | undefined;
}
</script>

<script setup lang="ts">
import { provide } from 'vue';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { usePopupPositioner } from '../../utils/popups/popupPositioner';
import { useTooltipPortalContext } from '../portal/TooltipPortalContext';
import { useTooltipRootContext } from '../root/TooltipRootContext';
import { TooltipPositionerContext } from './TooltipPositionerContext';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<TooltipPositionerProps>(), {
  as: 'div',
  disableAnchorTracking: false,
  align: 'center',
  alignOffset: 0,
  side: 'top',
  sideOffset: 0,
  arrowPadding: 5,
  collisionBoundary: 'clipping-ancestors',
  collisionPadding: 5,
  sticky: false,
  positionMethod: 'absolute',
});

defineSlots<{
  default(props: { state: TooltipPositionerState }): unknown;
  render: ComponentRenderFn<HTMLProps, TooltipPositionerState>;
}>();

const store = useTooltipRootContext();
const keepMounted = useTooltipPortalContext();

const { element, elementProps, state, positioning } = usePopupPositioner<TooltipPositionerState>(
  store,
  props,
  {
    keepMounted,
    state: () => ({
      instant:
        store.select('trackCursorAxis') !== 'none' ? 'tracking-cursor' : store.select('instantType'),
    }),
    inert: () =>
      !store.select('open') ||
      store.select('trackCursorAxis') === 'both' ||
      store.select('disableHoverablePopup'),
  },
);

provide(TooltipPositionerContext, positioning);

defineExpose({ element });
</script>

<template>
  <slot v-if="$slots.render" name="render" :props="elementProps()" :state="state" />
  <component :is="as" v-else v-bind="elementProps()"><slot :state="state" /></component>
</template>
