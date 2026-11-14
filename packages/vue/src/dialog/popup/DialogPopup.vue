<script lang="ts">
import type { HTMLAttributes } from 'vue';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../../internals/types';
import type { TransitionStatus } from '../../internals/useTransitionStatus';
import type { FocusOption } from '../../utils/popups/focus/FloatingFocusManager.vue';

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
import { computed } from 'vue';
import { COMPOSITE_KEYS } from '../../internals/composite/composite';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useOpenChangeComplete } from '../../internals/useOpenChangeComplete';
import { useRenderElement } from '../../internals/useRenderElement';
import FloatingFocusManager from '../../utils/popups/focus/FloatingFocusManager.vue';
import {
  FOCUSABLE_POPUP_PROPS,
  createDefaultInitialFocus,
} from '../../utils/popups/popupStoreUtils';
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

defineSlots<{
  default(props: { state: DialogPopupState }): unknown;
  render: ComponentRenderFn<HTMLProps, DialogPopupState>;
}>();

const store = useDialogRootContext();

useDialogPortalContext();

const disablePointerDismissal = computed(() => store.select('disablePointerDismissal'));
const modal = computed(() => store.select('modal'));
const mounted = computed(() => store.select('mounted'));
const nestedOpenDialogCount = computed(() => store.select('nestedOpenDialogCount'));
const open = computed(() => store.select('open'));
const openMethod = computed(() => store.select('openMethod'));

useOpenChangeComplete({
  open,
  ref: store.context.popupRef,
  onComplete() {
    if (open.value) {
      store.context.onOpenChangeComplete?.(true);
    }
  },
});

const defaultInitialFocus = createDefaultInitialFocus(store.context.popupRef);
const resolvedInitialFocus = computed(() =>
  props.initialFocus === undefined ? defaultInitialFocus : props.initialFocus,
);

const state = computed<DialogPopupState>(() => ({
  open: open.value,
  nested: store.select('nested'),
  transitionStatus: store.select('transitionStatus'),
  nestedDialogOpen: nestedOpenDialogCount.value > 0,
}));

function setPopupElement(element: HTMLElement | null) {
  store.context.popupRef.value = element;
  store.set('popupElement', element);
}

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

const { element, elementProps } = useRenderElement('div', props, {
  state,
  ref: setPopupElement,
  stateAttributesMapping: dialogStateAttributesMapping,
  props: (attrs) => [
    store.select('popupProps'),
    {
      id: store.select('defaultPopupId'),
      'aria-labelledby': store.select('titleElementId'),
      'aria-describedby': store.select('descriptionElementId'),
      role: store.select('role'),
      ...FOCUSABLE_POPUP_PROPS,
      hidden: mounted.value ? undefined : true,
      onKeydown: handleKeydown,
      style: { [DialogPopupCssVars.nestedDialogs]: nestedOpenDialogCount.value },
    },
    attrs,
  ],
});

defineExpose({ element });
</script>

<template>
  <FloatingFocusManager
    :store="store"
    :open-interaction-type="openMethod"
    :disabled="!mounted"
    :close-on-focus-out="!disablePointerDismissal"
    :initial-focus="resolvedInitialFocus"
    :return-focus="finalFocus"
    :modal="modal !== false"
    :outside-elements-inert="modal === true"
    restore-focus="popup"
    :get-inside-elements="getInsideElements"
  >
    <slot v-if="$slots.render" name="render" :props="elementProps()" :state="state" />
    <component :is="as" v-else v-bind="elementProps()"><slot :state="state" /></component>
  </FloatingFocusManager>
</template>
