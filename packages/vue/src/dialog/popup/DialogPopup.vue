<script lang="ts">
import type { HTMLAttributes } from 'vue';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../../internals/types';
import type { TransitionStatus } from '../../internals/useTransitionStatus';
import type { FocusOption } from '../../utils/popups/focus/usePopupFocus';

export interface DialogPopupState {
  /**
   * Whether the dialog is currently open.
   */
  open: boolean;
  /**
   * The transition status of the component.
   */
  transitionStatus: TransitionStatus;
  /**
   * Whether the dialog is nested within a parent dialog.
   */
  nested: boolean;
  /**
   * Whether the dialog has nested dialogs open.
   */
  nestedDialogOpen: boolean;
}

export interface DialogPopupProps
  extends
    VaseUIComponentProps<DialogPopupState>,
    /* @vue-ignore */ WithVaseUIEvent<HTMLAttributes> {
  /**
   * Determines the element to focus when the dialog is opened.
   * By default, focus moves to the first tabbable element inside the popup, except when the dialog
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
   * Determines the element to focus when the dialog is closed.
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
import { computed } from 'vue';
import { COMPOSITE_KEYS } from '../../internals/composite/listIndex';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useCastBooleanWarning } from '../../internals/useCastBooleanWarning';
import { useRenderElement } from '../../internals/useRenderElement';
import { usePopupFocus } from '../../utils/popups/focus/usePopupFocus';
import { createElementSetter, popupElementTarget } from '../../utils/popups/createElementSetter';
import { useDialogPortalContext } from '../portal/DialogPortalContext';
import { useDialogRootContext } from '../root/DialogRootContext';
import { dialogStateAttributesMapping } from '../utils/stateAttributesMapping';
import * as DialogPopupCssVars from './DialogPopupCssVars';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<DialogPopupProps>(), {
  as: 'div',
  initialFocus: undefined,
  finalFocus: undefined,
});

if (process.env.NODE_ENV !== 'production') {
  useCastBooleanWarning('Dialog.Popup');
}

defineSlots<{
  default(props: { state: DialogPopupState }): unknown;
  render: ComponentRenderFn<HTMLProps, DialogPopupState>;
}>();

const store = useDialogRootContext();

useDialogPortalContext();

const defaultInitialFocus = createDefaultInitialFocus(store.context.popupRef);
const open = computed(() => store.select('open'));
const nestedOpenDialogCount = computed(() => store.select('nestedOpenDialogCount'));

const state = computed<DialogPopupState>(() => ({
  open: open.value,
  nested: store.select('nested'),
  transitionStatus: store.select('transitionStatus'),
  nestedDialogOpen: nestedOpenDialogCount.value > 0,
}));

// The modal marks would set `inert` on the internal backdrop while the dialog is open. Their release
// at the close would then remove the `inert` that the portal gives the backdrop while the dialog
// closes, and the backdrop would take the presses of the exit animation.
function getInsideElements() {
  return [store.context.internalBackdropRef.value];
}

function handleKeydown(event: KeyboardEvent) {
  if (COMPOSITE_KEYS.has(event.key)) {
    event.stopPropagation();
  }
}

const { element, elementProps, setRef, usesRenderSlot } = useRenderElement<
  DialogPopupState,
  HTMLElement
>('div', props, {
  state,
  ref: createElementSetter(popupElementTarget(store)),
  stateAttributesMapping: dialogStateAttributesMapping,
  props: (attrs) => [
    popupBindings(store),
    {
      id: store.select('defaultPopupId'),
      'aria-labelledby': store.select('titleElementId'),
      'aria-describedby': store.select('descriptionElementId'),
      role: store.select('role'),
      ...FOCUSABLE_POPUP_PROPS,
      hidden: store.select('mounted') ? undefined : true,
      onKeydown: handleKeydown,
      style: { [DialogPopupCssVars.nestedDialogs]: nestedOpenDialogCount.value },
    },
    focusBindings(attrs),
    attrs,
  ],
});

const focusBindings = usePopupFocus(
  () => ({
    store,
    openInteractionType: store.select('openMethod'),
    disabled: !open.value,
    closeOnFocusOut: !store.select('disablePointerDismissal'),
    initialFocus: props.initialFocus === undefined ? defaultInitialFocus : props.initialFocus,
    returnFocus: props.finalFocus,
    modal: store.select('modal') !== false,
    outsideElementsInert: store.select('modal') === true,
    restoreFocus: 'popup',
    getInsideElements,
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
