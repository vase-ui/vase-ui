<script lang="ts">
import type { HTMLAttributes } from 'vue';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../../internals/types';
import type { Align, Side } from '../../internals/useAnchorPositioning';
import type { TransitionStatus } from '../../internals/useTransitionStatus';
import type { FocusOption } from '../../utils/popups/focus/FloatingFocusManager.vue';

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
    /* @vue-ignore */ WithVaseUIEvent<HTMLAttributes> {
  /**
   * Determines the element to focus when the popover is opened.
   * By default, focus moves to the first tabbable element inside the popup, except when the popover
   * is opened by touch — then the popup itself is focused to avoid opening the virtual keyboard.
   *
   * - `false`: Do not move focus.
   * - `true`: Move focus based on the default behavior (first tabbable element or popup).
   * - An element, a component, or a ref of one: Move focus to that element.
   * - `function`: Called with the interaction type (`mouse`, `touch`, `pen`, or `keyboard`).
   *   Return an element to focus, `true` to use the default behavior, `null` to fall back to the default behavior, or `false`/`undefined` to do nothing.
   */
  initialFocus?: FocusOption | undefined;
  /**
   * Determines the element to focus when the popover is closed.
   *
   * - `false`: Do not move focus.
   * - `true`: Move focus based on the default behavior (trigger or previously focused element).
   * - An element, a component, or a ref of one: Move focus to that element.
   * - `function`: Called with the interaction type (`mouse`, `touch`, `pen`, or `keyboard`).
   *   Return an element to focus, `true` to use the default behavior, `null` to fall back to the default behavior, or `false`/`undefined` to do nothing.
   */
  finalFocus?: FocusOption | undefined;
}
</script>

<script setup lang="ts">
import { isHTMLElement } from '@floating-ui/utils/dom';
import { computed, watch } from 'vue';
import { COMPOSITE_KEYS } from '../../internals/composite/composite';
import { getDisabledMountTransitionStyles } from '../../internals/getDisabledMountTransitionStyles';
import { REASONS } from '../../internals/reasons';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useOpenChangeComplete } from '../../internals/useOpenChangeComplete';
import { useRenderElement } from '../../internals/useRenderElement';
import { useToolbarRootContext } from '../../toolbar/root/ToolbarRootContext';
import FloatingFocusManager from '../../utils/popups/focus/FloatingFocusManager.vue';
import { useHoverPopupInteraction } from '../../utils/popups/interactions/useHoverPopupInteraction';
import { popupTransitionStateMapping } from '../../utils/popups/popupStateMapping';
import {
  FOCUSABLE_POPUP_PROPS,
  createDefaultInitialFocus,
} from '../../utils/popups/popupStoreUtils';
import { usePopoverPositionerContext } from '../positioner/PopoverPositionerContext';
import { usePopoverRootContext } from '../root/PopoverRootContext';
import { useClosePartCount } from '../utils/closePart';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<PopoverPopupProps>(), {
  as: 'div',
  initialFocus: undefined,
  finalFocus: undefined,
});

defineSlots<{
  default(props: { state: PopoverPopupState }): unknown;
  render: ComponentRenderFn<HTMLProps, PopoverPopupState>;
}>();

const store = usePopoverRootContext();
const { side, align } = usePopoverPositionerContext();
const insideToolbar = useToolbarRootContext(true) !== undefined;
const hasClosePart = useClosePartCount();

const open = computed(() => store.select('open'));
const mounted = computed(() => store.select('mounted'));
const transitionStatus = computed(() => store.select('transitionStatus'));
const activeTriggerElement = computed(() => {
  const trigger = store.select('activeTriggerElement');
  return isHTMLElement(trigger) ? trigger : undefined;
});

useOpenChangeComplete({
  open,
  ref: store.context.popupRef,
  onComplete() {
    if (open.value) {
      store.context.onOpenChangeComplete?.(true);
    }
  },
});

useHoverPopupInteraction(store, {
  enabled: () => store.select('openOnHover') && !store.select('disabled'),
  closeDelay: () => store.select('closeDelay'),
});

const defaultInitialFocus = createDefaultInitialFocus(store.context.popupRef);
const resolvedInitialFocus = computed(() =>
  props.initialFocus === undefined ? defaultInitialFocus : props.initialFocus,
);

const focusManagerModal = computed(() => store.select('modal') !== false && hasClosePart.value);
// `immediate` also writes `false` for a popup that replaces a popup with a close part.
watch(focusManagerModal, (modal) => store.set('focusManagerModal', modal), { immediate: true });

// The trigger writes its guards to the store after the popup opens, so the focus manager reads the
// refs when it needs them.
function getInsideElements() {
  return [store.context.beforeTriggerFocusGuardRef.value];
}

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
  <FloatingFocusManager
    :store="store"
    :open-interaction-type="store.select('openMethod')"
    :modal="focusManagerModal"
    :disabled="!mounted || store.select('openChangeReason') === REASONS.triggerHover"
    :initial-focus="resolvedInitialFocus"
    :return-focus="finalFocus"
    restore-focus="popup"
    :get-inside-elements="getInsideElements"
    :previous-focusable-element="activeTriggerElement"
    :next-focusable-element="store.context.triggerFocusTargetRef"
    :before-content-focus-guard-ref="store.context.beforeContentFocusGuardRef"
  >
    <slot v-if="$slots.render" name="render" :props="elementProps()" :state="state" />
    <component :is="as" v-else v-bind="elementProps()"><slot :state="state" /></component>
  </FloatingFocusManager>
</template>
