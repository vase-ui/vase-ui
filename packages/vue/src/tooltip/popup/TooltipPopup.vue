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
import { DISABLED_TRANSITIONS_STYLE } from '../../internals/constants';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useOpenChangeComplete } from '../../internals/useOpenChangeComplete';
import { useRenderElement } from '../../internals/useRenderElement';
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

useOpenChangeComplete({
  open,
  ref: store.context.popupRef,
  onComplete() {
    if (open.value) {
      store.context.onOpenChangeComplete?.(true);
    }
  },
});

const state = computed<TooltipPopupState>(() => ({
  open: open.value,
  side: side.value,
  align: align.value,
  instant: store.select('instantType'),
  transitionStatus: transitionStatus.value,
}));

let popupElement: HTMLElement | null = null;

const { element, elementProps } = useRenderElement('div', props, {
  state,
  ref: [
    (popup) => {
      // A compiled template can mount a new popup before it unmounts the old one. The old one then
      // must not clear the element of the new one.
      if (popup !== null || store.context.popupRef.value === popupElement) {
        store.context.popupRef.value = popup;
        store.set('popupElement', popup);
      }
      popupElement = popup;
    },
  ],
  stateAttributesMapping: popupTransitionStateMapping,
  props: (attrs) => [
    FOCUSABLE_POPUP_PROPS,
    store.select('popupProps'),
    transitionStatus.value === 'starting' ? DISABLED_TRANSITIONS_STYLE : undefined,
    attrs,
  ],
});

defineExpose({ element });
</script>

<template>
  <slot v-if="$slots.render" name="render" :props="elementProps()" :state="state" />
  <component :is="as" v-else v-bind="elementProps()"><slot :state="state" /></component>
</template>
