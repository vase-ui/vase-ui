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
import { popupBindings, FOCUSABLE_POPUP_PROPS } from '../../utils/popups/popupBindings';
import { popupStoreSelectors } from '../../utils/popups/usePopupRoot';
import { computed, provide } from 'vue';
import { getDisabledMountTransitionStyles } from '../../internals/getDisabledMountTransitionStyles';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useRenderElement } from '../../internals/useRenderElement';
import { PopupStyleContext } from '../../utils/popups/viewport/PopupViewportContext';
import { createElementSetter, popupElementTarget } from '../../utils/popups/createElementSetter';
import { usePopupHover } from '../../utils/popups/interactions/usePopupHover';
import { popupTransitionStateMapping } from '../../utils/popups/popupStateMapping';
import { useTooltipPositionerContext, useTooltipRootContext } from '../root/TooltipRootContext';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<TooltipPopupProps>(), { as: 'div' });

defineSlots<{
  default(props: { state: TooltipPopupState }): unknown;
  render: ComponentRenderFn<HTMLProps, TooltipPopupState>;
}>();

const { store } = useTooltipRootContext();
const { side, align } = useTooltipPositionerContext();

const open = computed(() => popupStoreSelectors.open(store.state));
const transitionStatus = computed(() => popupStoreSelectors.transitionStatus(store.state));

usePopupHover(store).popup({
  enabled: () => !store.state.disabled,
  closeDelay: () => store.state.closeDelay,
});

const state = computed<TooltipPopupState>(() => ({
  open: open.value,
  side: side.value,
  align: align.value,
  instant: store.state.instantType,
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
    popupBindings(store),
    { style: store.context.viewportStyles.value?.popup.value },
    getDisabledMountTransitionStyles(transitionStatus.value),
    attrs,
  ],
});

provide(PopupStyleContext, () => elementProps().style);

defineExpose({ element });
</script>

<template>
  <slot v-if="usesRenderSlot()" name="render" :props="elementProps()" :state="state" />
  <component :is="as" v-else v-bind="elementProps()" :ref="setRef">
    <slot :state="state" />
  </component>
</template>
