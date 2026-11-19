<script lang="ts">
import type { HTMLAttributes } from 'vue';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../../internals/types';
import type { Align, Side } from '../../internals/useAnchorPositioning';
import type { TransitionStatus } from '../../internals/useTransitionStatus';
import type { FocusOption } from '../../utils/popups/focus/usePopupFocus';

export interface ComboboxPopupState {
  /**
   * Whether the component is open.
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
   * The transition status of the component.
   */
  transitionStatus: TransitionStatus;
  /**
   * Whether there are no items to display.
   */
  empty: boolean;
}

export interface ComboboxPopupProps
  extends
    VaseUIComponentProps<ComboboxPopupState>,
    /* @vue-ignore */ WithVaseUIEvent<HTMLAttributes> {
  /**
   * Determines the element to focus when the popup is opened.
   *
   * - `false`: Do not move focus.
   * - `true`: Move focus based on the default behavior (first tabbable element or popup).
   * - An element, a component, or a ref of one: Move focus to that element.
   * - `function`: Called with the interaction type (`mouse`, `touch`, `pen`, or `keyboard`).
   *   Return an element to focus, `true` to use the default behavior, or `false`/`undefined` to do nothing.
   */
  initialFocus?: FocusOption | undefined;
  /**
   * Determines the element to focus when the popup is closed.
   *
   * - `false`: Do not move focus.
   * - `true`: Move focus based on the default behavior (trigger or previously focused element).
   * - An element, a component, or a ref of one: Move focus to that element.
   * - `function`: Called with the interaction type (`mouse`, `touch`, `pen`, or `keyboard`).
   *   Return an element to focus, `true` to use the default behavior, or `false`/`undefined` to do nothing.
   */
  finalFocus?: FocusOption | undefined;
}
</script>

<script setup lang="ts">
import { popupBindings } from '../../utils/popups/popupBindings';
import { computed, toRaw } from 'vue';
import type { InteractionType } from '../../utils/popups/usePopupTrigger';
import { contains, getTarget } from '../../common/shadowDom';
import { getDisabledMountTransitionStyles } from '../../internals/getDisabledMountTransitionStyles';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useCastBooleanWarning } from '../../internals/useCastBooleanWarning';
import { useRenderElement } from '../../internals/useRenderElement';
import { usePopupFocus } from '../../utils/popups/focus/usePopupFocus';
import { popupTransitionStateMapping } from '../../utils/popups/popupStateMapping';
import { createElementSetter, popupElementTarget } from '../../utils/popups/createElementSetter';
import { useComboboxPositionerContext } from '../positioner/ComboboxPositionerContext';
import { useComboboxRootContext } from '../root/ComboboxRootContext';
import { getComboboxPopupId } from '../root/utils';
import { useDismissButton } from '../utils/ComboboxInternalDismissButton';
import { useListEmpty } from '../utils/parts';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<ComboboxPopupProps>(), {
  as: 'div',
  initialFocus: undefined,
  finalFocus: undefined,
});

if (process.env.NODE_ENV !== 'production') {
  useCastBooleanWarning('Combobox.Popup');
}

defineSlots<{
  default(props: { state: ComboboxPopupState }): unknown;
  render: ComponentRenderFn<HTMLProps, ComboboxPopupState>;
}>();

const store = useComboboxRootContext();
const positioning = useComboboxPositionerContext();

const open = computed(() => store.select('open'));
const openMethod = computed(() => store.select('openMethod'));
const transitionStatus = computed(() => store.select('transitionStatus'));
const inputInsidePopup = computed(() => store.select('inputInsidePopup'));

const empty = useListEmpty();
const popupId = computed(() =>
  inputInsidePopup.value ? getComboboxPopupId(store.select('id')) : undefined,
);

const state = computed<ComboboxPopupState>(() => ({
  open: open.value,
  side: positioning.side.value,
  align: positioning.align.value,
  anchorHidden: positioning.anchorHidden.value,
  transitionStatus: transitionStatus.value,
  empty: empty.value,
}));

function handleFocusin(event: FocusEvent) {
  const target = getTarget(event) as Element | null;
  if (
    openMethod.value !== 'touch' &&
    (contains(toRaw(store.state).listElement, target) || target === event.currentTarget)
  ) {
    store.context.inputRef.value?.focus();
  }
}

const { element, elementProps, setRef, usesRenderSlot } = useRenderElement<
  ComboboxPopupState,
  HTMLElement
>('div', props, {
  state,
  ref: createElementSetter(popupElementTarget(store)),
  stateAttributesMapping: popupTransitionStateMapping,
  props: (attrs) => [
    popupBindings(store),
    {
      id: popupId.value,
      role: inputInsidePopup.value ? 'dialog' : 'presentation',
      onFocusin: handleFocusin,
    },
    getDisabledMountTransitionStyles(transitionStatus.value),
    focusBindings(attrs),
    attrs,
  ],
});

// Default initial focus logic:
// If opened by touch, focus the popup element to prevent the virtual keyboard from opening
// (this is required for Android specifically as iOS handles this automatically).
function focusInputOrPopup(interactionType: InteractionType) {
  return interactionType === 'touch'
    ? store.context.popupRef.value
    : toRaw(store.state).inputElement;
}

const resolvedInitialFocus = computed(() => {
  if (props.initialFocus !== undefined) {
    return props.initialFocus;
  }
  return inputInsidePopup.value ? focusInputOrPopup : false;
});

const resolvedFinalFocus = computed(() => {
  if (props.finalFocus != null) {
    return props.finalFocus;
  }
  return inputInsidePopup.value ? undefined : false;
});

const focusManagerModal = computed(() => !inputInsidePopup.value || store.select('modal'));
// Base UI stops the focus manager when the popup unmounts. Its focus guards have `aria-hidden`, and
// during an exit animation the Tab key can still reach them (BUG-5519). This part stops the focus
// manager when the popup closes.
const focusManagerDisabled = computed(() => !open.value);

function getInsideElements() {
  return [store.context.startDismissRef.value, store.context.endDismissRef.value];
}

const dismissButton = useDismissButton(element, focusManagerModal, store.context.endDismissRef);

const focusBindings = usePopupFocus(
  () => ({
    store: store.interactions,
    disabled: focusManagerDisabled.value,
    modal: focusManagerModal.value,
    openInteractionType: openMethod.value,
    initialFocus: resolvedInitialFocus.value,
    returnFocus: resolvedFinalFocus.value,
    getInsideElements,
    nodesAfterElement: dismissButton.value ? [dismissButton.value] : undefined,
  }),
  element,
  true,
);

defineExpose({ element });
</script>

<template>
  <slot v-if="usesRenderSlot()" name="render" :props="elementProps()" :state="state" />
  <component :is="as" v-else v-bind="elementProps()" :ref="setRef">
    <slot :state="state" />
  </component>
</template>
