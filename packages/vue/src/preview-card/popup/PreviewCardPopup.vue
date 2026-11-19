<script lang="ts">
import type { HTMLAttributes } from 'vue';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../../internals/types';
import type { Align, Side } from '../../internals/useAnchorPositioning';
import type { TransitionStatus } from '../../internals/useTransitionStatus';

export interface PreviewCardPopupState {
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
   * Whether transitions should be skipped.
   */
  instant: 'dismiss' | 'focus' | undefined;
  /**
   * The transition status of the component.
   */
  transitionStatus: TransitionStatus;
}

export interface PreviewCardPopupProps
  extends
    VaseUIComponentProps<PreviewCardPopupState>,
    /* @vue-ignore */ WithVaseUIEvent<HTMLAttributes> {}
</script>

<script setup lang="ts">
import { popupBindings, FOCUSABLE_POPUP_PROPS } from '../../utils/popups/popupBindings';
import { computed, provide } from 'vue';
import { DISABLED_TRANSITIONS_STYLE } from '../../internals/constants';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useRenderElement } from '../../internals/useRenderElement';
import { PopupStyleContext } from '../../utils/popups/viewport/PopupViewportContext';
import { createElementSetter, popupElementTarget } from '../../utils/popups/createElementSetter';
import { useHoverPopupInteraction } from '../../utils/popups/interactions/useHoverPopupInteraction';
import { popupTransitionStateMapping } from '../../utils/popups/popupStateMapping';
import { usePreviewCardPositionerContext } from '../positioner/PreviewCardPositionerContext';
import { usePreviewCardRootContext } from '../root/PreviewCardContext';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<PreviewCardPopupProps>(), { as: 'div' });

defineSlots<{
  default(props: { state: PreviewCardPopupState }): unknown;
  render: ComponentRenderFn<HTMLProps, PreviewCardPopupState>;
}>();

const store = usePreviewCardRootContext();
const { side, align } = usePreviewCardPositionerContext();

const open = computed(() => store.select('open'));
const transitionStatus = computed(() => store.select('transitionStatus'));

useHoverPopupInteraction(store, { closeDelay: () => store.select('closeDelay') });

const state = computed<PreviewCardPopupState>(() => ({
  open: open.value,
  side: side.value,
  align: align.value,
  instant: store.select('instantType'),
  transitionStatus: transitionStatus.value,
}));

const { element, elementProps, setRef, usesRenderSlot } = useRenderElement<
  PreviewCardPopupState,
  HTMLElement
>('div', props, {
  state,
  ref: createElementSetter(popupElementTarget(store)),
  stateAttributesMapping: popupTransitionStateMapping,
  props: (attrs) => [
    FOCUSABLE_POPUP_PROPS,
    popupBindings(store),
    { style: store.context.viewportStyles.value?.popup.value },
    transitionStatus.value === 'starting' ? DISABLED_TRANSITIONS_STYLE : undefined,
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
