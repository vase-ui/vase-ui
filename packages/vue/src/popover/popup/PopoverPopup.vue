<script lang="ts">
import type { HTMLAttributes } from 'vue';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../../internals/types';
import type { Align, Side } from '../../internals/useAnchorPositioning';
import type { TransitionStatus } from '../../internals/useTransitionStatus';
import type { FocusOption } from '../../utils/popups/focus/FloatingFocusManager';

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
import {
  popupBindings,
  FOCUSABLE_POPUP_PROPS,
  createDefaultInitialFocus,
} from '../../utils/popups/popupBindings';
import { isHTMLElement } from '@floating-ui/utils/dom';
import { computed, provide, watch } from 'vue';
import { COMPOSITE_KEYS } from '../../internals/composite/listIndex';
import { getDisabledMountTransitionStyles } from '../../internals/getDisabledMountTransitionStyles';
import { REASONS } from '../../internals/reasons';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useCastBooleanWarning } from '../../internals/useCastBooleanWarning';
import { useRenderElement } from '../../internals/useRenderElement';
import { PopupStyleContext } from '../../utils/popups/viewport/PopupViewportContext';
import { useToolbarRootContext } from '../../toolbar/root/ToolbarRootContext';
import { useFloatingFocusManager } from '../../utils/popups/focus/FloatingFocusManager';
import { usePopupHover } from '../../utils/popups/interactions/usePopupHover';
import { popupTransitionStateMapping } from '../../utils/popups/popupStateMapping';
import { createElementSetter, popupElementTarget } from '../../utils/popups/createElementSetter';
import { usePopoverPositionerContext } from '../positioner/PopoverPositionerContext';
import { usePopoverRootContext } from '../root/PopoverRootContext';
import { useClosePartCount } from '../utils/closePart';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<PopoverPopupProps>(), {
  as: 'div',
  initialFocus: undefined,
  finalFocus: undefined,
});

if (process.env.NODE_ENV !== 'production') {
  useCastBooleanWarning('Popover.Popup');
}

defineSlots<{
  default(props: { state: PopoverPopupState }): unknown;
  render: ComponentRenderFn<HTMLProps, PopoverPopupState>;
}>();

const { store, open, mounted, transitionStatus, trigger } = usePopoverRootContext();
const { side, align } = usePopoverPositionerContext();
const insideToolbar = useToolbarRootContext(true) !== undefined;
const hasClosePart = useClosePartCount();

const activeTriggerElement = computed(() => {
  const element = trigger.value;
  return isHTMLElement(element) ? element : undefined;
});

usePopupHover(store).popup({
  enabled: () => store.select('openOnHover') && !store.select('disabled'),
  closeDelay: () => store.state.closeDelay,
});

const defaultInitialFocus = createDefaultInitialFocus(store.context.popupRef);
const resolvedInitialFocus = computed(() =>
  props.initialFocus === undefined ? defaultInitialFocus : props.initialFocus,
);

const focusManagerModal = computed(() => store.state.modal !== false && hasClosePart.value);
// `immediate` also writes `false` for a popup that replaces a popup with a close part. A portal
// renders the popup after the mount, so a server does not run the watcher.
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

const { element, elementProps, setRef, usesRenderSlot } = useRenderElement<
  PopoverPopupState,
  HTMLElement
>('div', props, {
  state,
  ref: createElementSetter(popupElementTarget(store)),
  stateAttributesMapping: popupTransitionStateMapping,
  props: (attrs) => [
    popupBindings(store),
    { style: store.context.viewportStyles.value?.popup.value },
    {
      id: store.state.defaultPopupId,
      role: 'dialog',
      ...FOCUSABLE_POPUP_PROPS,
      'aria-labelledby': store.state.titleElementId,
      'aria-describedby': store.state.descriptionElementId,
      onKeydown: handleKeydown,
    },
    getDisabledMountTransitionStyles(transitionStatus.value),
    attrs,
  ],
});

useFloatingFocusManager(
  () => ({
    store,
    openInteractionType: store.state.openMethod,
    modal: focusManagerModal.value,
    disabled: !mounted.value || store.state.openChangeReason === REASONS.triggerHover,
    initialFocus: resolvedInitialFocus.value,
    returnFocus: props.finalFocus,
    restoreFocus: 'popup',
    getInsideElements,
    previousFocusableElement: activeTriggerElement.value,
    nextFocusableElement: store.context.triggerFocusTargetRef,
    beforeContentFocusGuardRef: store.context.beforeContentFocusGuardRef,
    afterContentFocusGuardRef: store.context.afterContentFocusGuardRef,
  }),
  element,
);

provide(PopupStyleContext, () => elementProps().style);

defineExpose({ element });
</script>

<template>
  <slot v-if="usesRenderSlot()" name="render" :props="elementProps()" :state="state" />
  <component :is="as" v-else v-bind="elementProps()" :ref="setRef">
    <slot :state="state" />
  </component>
</template>
