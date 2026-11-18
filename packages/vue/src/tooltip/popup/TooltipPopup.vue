<script lang="ts">
import type { HTMLAttributes } from 'vue';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../../internals/types';
import type { Align, Side } from '../../internals/useAnchorPositioning';
import type { TransitionStatus } from '../../internals/useTransitionStatus';

export interface TooltipPopupState {
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
   * Whether transitions should be skipped.
   */
  instant: 'delay' | 'focus' | 'dismiss' | undefined;
  /**
   * The transition status of the component.
   */
  transitionStatus: TransitionStatus;
}

export interface TooltipPopupProps
  extends
    VaseUIComponentProps<TooltipPopupState>,
    /* @vue-ignore */ WithVaseUIEvent<HTMLAttributes> {}
</script>

<script setup lang="ts">
import { computed } from 'vue';
import { getDisabledMountTransitionStyles } from '../../internals/getDisabledMountTransitionStyles';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useRenderElement } from '../../internals/useRenderElement';
import { createElementSetter, popupElementTarget } from '../../utils/popups/createElementSetter';
import { useHoverPopupInteraction } from '../../utils/popups/interactions/useHoverPopupInteraction';
import { popupTransitionStateMapping } from '../../utils/popups/popupStateMapping';
import { FOCUSABLE_POPUP_PROPS } from '../../utils/popups/popupStoreUtils';
import { useTooltipPositionerContext } from '../positioner/TooltipPositionerContext';
import { useTooltipRootContext } from '../root/TooltipRootContext';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<TooltipPopupProps>(), { as: 'div' });

defineSlots<{
  default(props: { state: TooltipPopupState }): unknown;
  render: ComponentRenderFn<HTMLProps, TooltipPopupState>;
}>();

const store = useTooltipRootContext();
const { side, align } = useTooltipPositionerContext();

const open = computed(() => store.select('open'));
const transitionStatus = computed(() => store.select('transitionStatus'));

useHoverPopupInteraction(store, {
  enabled: () => !store.select('disabled'),
  closeDelay: () => store.select('closeDelay'),
});

const state = computed<TooltipPopupState>(() => ({
  open: open.value,
  side: side.value,
  align: align.value,
  instant: store.select('instantType'),
  transitionStatus: transitionStatus.value,
}));

const { element, elementProps, setRef, usesRenderSlot } = useRenderElement<
  TooltipPopupState,
  HTMLElement
>('div', props, {
  state,
  ref: createElementSetter(popupElementTarget(store)),
  stateAttributesMapping: popupTransitionStateMapping,
  props: (attrs) => [
    FOCUSABLE_POPUP_PROPS,
    store.select('popupProps'),
    { style: store.context.viewportStyles.value?.popup.value },
    getDisabledMountTransitionStyles(transitionStatus.value),
    attrs,
  ],
});

defineExpose({ element });
</script>

<template>
  <slot v-if="usesRenderSlot()" name="render" :props="elementProps()" :state="state" />
  <component :is="as" v-else v-bind="elementProps()" :ref="setRef">
    <slot :state="state" />
  </component>
</template>
