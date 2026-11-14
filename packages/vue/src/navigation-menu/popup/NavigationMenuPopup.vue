<script lang="ts">
import type { HTMLAttributes } from 'vue';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../../internals/types';
import type { Align, Side } from '../../internals/useAnchorPositioning';
import type { TransitionStatus } from '../../internals/useTransitionStatus';

export interface NavigationMenuPopupState {
  /**
   * If `true`, the popup is open.
   */
  open: boolean;
  /**
   * The transition status of the popup.
   */
  transitionStatus: TransitionStatus;
  /**
   * The side of the anchor the popup is positioned on.
   */
  side: Side;
  /**
   * The alignment of the popup relative to the anchor.
   */
  align: Align;
  /**
   * Whether the anchor element is hidden.
   */
  anchorHidden: boolean;
}

export interface NavigationMenuPopupProps
  extends
    VaseUIComponentProps<NavigationMenuPopupState>,
    /* @vue-ignore */ Omit<WithVaseUIEvent<HTMLAttributes>, 'id'> {
  /**
   * The id of the element. The active trigger names it in `aria-controls`.
   */
  id?: string | undefined;
}
</script>

<script setup lang="ts">
import { computed } from 'vue';
import type { CSSProperties } from 'vue';
import { useDirection } from '../../internals/direction-context/DirectionContext';
import { getDisabledMountTransitionStyles } from '../../internals/getDisabledMountTransitionStyles';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useVaseUiId } from '../../internals/useBaseUiId';
import { useRenderElement } from '../../internals/useRenderElement';
import { popupTransitionStateMapping } from '../../utils/popups/popupStateMapping';
import { useNavigationMenuPositionerContext } from '../positioner/NavigationMenuPositionerContext';
import { useNavigationMenuRootContext } from '../root/NavigationMenuRootContext';
import { createElementSetter } from '../utils/createElementSetter';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<NavigationMenuPopupProps>(), { as: 'nav' });

defineSlots<{
  default(props: { state: NavigationMenuPopupState }): unknown;
  render: ComponentRenderFn<HTMLProps, NavigationMenuPopupState>;
}>();

const { open, transitionStatus, popupElement } = useNavigationMenuRootContext();
const positioning = useNavigationMenuPositionerContext();
const direction = useDirection();

const popupId = useVaseUiId(() => props.id);

const state = computed<NavigationMenuPopupState>(() => ({
  open: open.value,
  transitionStatus: transitionStatus.value,
  side: positioning.side.value,
  align: positioning.align.value,
  anchorHidden: positioning.anchorHidden.value,
}));

// With the side `top`, the popup is anchored at its bottom edge, and with the side `left` at its
// right edge. Its size transition then moves the edge that is away from the trigger.
const originSideStyle = computed<CSSProperties | undefined>(() => {
  const side = positioning.side.value;
  const isPhysicalLeft =
    side === 'left' || side === (direction.value === 'rtl' ? 'inline-end' : 'inline-start');

  if (side !== 'top' && !isPhysicalLeft) {
    return undefined;
  }

  return {
    position: 'absolute',
    [side === 'top' ? 'bottom' : 'top']: '0',
    [isPhysicalLeft ? 'right' : 'left']: '0',
  };
});

const { element, elementProps } = useRenderElement('nav', props, {
  state,
  stateAttributesMapping: popupTransitionStateMapping,
  ref: createElementSetter(popupElement),
  props: (attrs) => [
    { id: popupId.value, tabindex: -1, style: originSideStyle.value },
    getDisabledMountTransitionStyles(transitionStatus.value),
    attrs,
  ],
});

defineExpose({ element });
</script>

<template>
  <slot v-if="$slots.render" name="render" :props="elementProps()" :state="state" />
  <component :is="as" v-else v-bind="elementProps()"><slot :state="state" /></component>
</template>
