<script lang="ts">
import type { HTMLAttributes } from 'vue';
import type {
  ComponentRenderFn,
  HTMLProps,
  VaseUIComponentProps,
  WithVaseUIEvent,
} from '../../src/internals/types';
import type {
  Align,
  Side,
  UseAnchorPositioningSharedParameters,
} from '../../src/internals/useAnchorPositioning';

export interface PositionerPartState {
  /** Whether the popup is mounted. */
  open: boolean;
  /** The side of the anchor that the part is on. */
  side: Side;
  /** The alignment of the part to the anchor. */
  align: Align;
  /** Whether the anchor is hidden. */
  anchorHidden: boolean;
}

export interface PositionerPartProps
  extends
    VaseUIComponentProps<PositionerPartState>,
    UseAnchorPositioningSharedParameters,
    /* @vue-ignore */ WithVaseUIEvent<HTMLAttributes> {
  /**
   * Whether the popup is mounted. A root gives this value to a positioner of a family.
   * @default true
   */
  mounted?: boolean | undefined;
  /**
   * Whether the part stays in the DOM while the popup is not mounted.
   * @default false
   */
  keepMounted?: boolean | undefined;
  /** The trigger of the root. It is the anchor when the part has no `anchor`. */
  trigger?: Element | null | undefined;
}
</script>

<script setup lang="ts">
import { computed, shallowRef } from 'vue';
import { POPUP_COLLISION_AVOIDANCE } from '../../src/internals/constants';
import { useAnchorPositioning } from '../../src/internals/useAnchorPositioning';
import { useRenderElement } from '../../src/internals/useRenderElement';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<PositionerPartProps>(), {
  as: 'div',
  mounted: true,
  keepMounted: false,
});

defineSlots<{
  default(props: { state: PositionerPartState }): unknown;
  render: ComponentRenderFn<HTMLProps, PositionerPartState>;
}>();

const positionerElement = shallowRef<HTMLElement | null>(null);

const positioning = useAnchorPositioning({
  anchor: () => props.anchor,
  positionMethod: () => props.positionMethod,
  side: () => props.side,
  sideOffset: () => props.sideOffset,
  align: () => props.align,
  alignOffset: () => props.alignOffset,
  collisionBoundary: () => props.collisionBoundary,
  collisionPadding: () => props.collisionPadding,
  sticky: () => props.sticky,
  arrowPadding: () => props.arrowPadding,
  disableAnchorTracking: () => props.disableAnchorTracking,
  collisionAvoidance: () => props.collisionAvoidance ?? POPUP_COLLISION_AVOIDANCE,
  keepMounted: () => props.keepMounted,
  mounted: () => props.mounted,
  positionerElement,
  defaultAnchor: () => props.trigger,
});

const state = computed<PositionerPartState>(() => ({
  open: props.mounted,
  side: positioning.side.value,
  align: positioning.align.value,
  anchorHidden: positioning.anchorHidden.value,
}));

const { element, elementProps } = useRenderElement('div', props, {
  state,
  stateAttributesMapping: {
    anchorHidden: (value) => (value ? { 'data-anchor-hidden': '' } : null),
  },
  ref: (positioner) => {
    positionerElement.value = positioner;
  },
  props: (attrs) => [
    { role: 'presentation', hidden: !props.mounted, style: positioning.positionerStyles.value },
    attrs,
  ],
});

defineExpose({ element, update: positioning.update });
</script>

<template>
  <slot v-if="$slots.render" name="render" :props="elementProps()" :state="state" />
  <component :is="as" v-else v-bind="elementProps()"><slot :state="state" /></component>
</template>
