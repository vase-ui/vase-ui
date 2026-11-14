<script lang="ts">
import type { HTMLAttributes } from 'vue';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../../internals/types';
import type { Align, Side } from '../../internals/useAnchorPositioning';
import type { TransitionStatus } from '../../internals/useTransitionStatus';

export interface PopoverPopupState {
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
   * The transition status of the component.
   */
  transitionStatus: TransitionStatus;
  /**
   * Whether transitions should be skipped.
   */
  instant: 'dismiss' | 'click' | 'focus' | 'trigger-change' | undefined;
}

export interface PopoverPopupProps
  extends
    VaseUIComponentProps<PopoverPopupState>,
    /* @vue-ignore */ WithVaseUIEvent<HTMLAttributes> {}
</script>

<script setup lang="ts">
import { computed, watch } from 'vue';
import { COMPOSITE_KEYS } from '../../internals/composite/composite';
import { getDisabledMountTransitionStyles } from '../../internals/getDisabledMountTransitionStyles';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useOpenChangeComplete } from '../../internals/useOpenChangeComplete';
import { useRenderElement } from '../../internals/useRenderElement';
import { useToolbarRootContext } from '../../toolbar/root/ToolbarRootContext';
import { popupTransitionStateMapping } from '../../utils/popups/popupStateMapping';
import { FOCUSABLE_POPUP_PROPS } from '../../utils/popups/popupStoreUtils';
import { usePopoverPositionerContext } from '../positioner/PopoverPositionerContext';
import { usePopoverRootContext } from '../root/PopoverRootContext';
import { useClosePartCount } from '../utils/closePart';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<PopoverPopupProps>(), { as: 'div' });

defineSlots<{
  default(props: { state: PopoverPopupState }): unknown;
  render: ComponentRenderFn<HTMLProps, PopoverPopupState>;
}>();

const store = usePopoverRootContext();
const { side, align } = usePopoverPositionerContext();
const insideToolbar = useToolbarRootContext(true) !== undefined;
const hasClosePart = useClosePartCount();

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

// `immediate` also writes `false` for a popup that replaces a popup with a close part.
watch(
  () => store.select('modal') !== false && hasClosePart.value,
  (focusManagerModal) => store.set('focusManagerModal', focusManagerModal),
  { immediate: true },
);

const state = computed<PopoverPopupState>(() => ({
  open: open.value,
  side: side.value,
  align: align.value,
  instant: store.select('instantType'),
  transitionStatus: transitionStatus.value,
}));

function handleKeydown(event: KeyboardEvent) {
  // A portal container inside the toolbar puts the popup in the toolbar element. The composite
  // handler of the toolbar would then move the focus out of the popup.
  if (insideToolbar && COMPOSITE_KEYS.has(event.key)) {
    event.stopPropagation();
  }
}

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
    store.select('popupProps'),
    {
      id: store.select('defaultPopupId'),
      role: 'dialog',
      ...FOCUSABLE_POPUP_PROPS,
      'aria-labelledby': store.select('titleElementId'),
      'aria-describedby': store.select('descriptionElementId'),
      onKeydown: handleKeydown,
    },
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
