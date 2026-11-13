<script lang="ts">
import type { VaseUIChangeEventDetails } from '../../internals/createBaseUIEventDetails';
import type { REASONS } from '../../internals/reasons';
import type { PopoverHandle } from '../store/PopoverHandle';

export interface PopoverRootState {}

export interface PopoverRootProps<Payload = unknown> {
  /**
   * Whether the popover is initially open.
   *
   * To render a controlled popover, use the `open` prop instead.
   * @default false
   */
  defaultOpen?: boolean | undefined;
  /**
   * Whether the popover is currently open.
   */
  open?: boolean | undefined;
  /**
   * Determines if the popover enters a modal state when open.
   * - `true`: user interaction is limited to the popover: document page scroll is locked, and pointer interactions on outside elements are disabled.
   * - `false`: user interaction with the rest of the document is allowed.
   * - `'trap-focus'`: focus is trapped inside the popover, but document page scroll is not locked and pointer interactions outside of it remain enabled.
   *
   * On touch devices, a `true` modal blocks outside taps but leaves the page scrollable unless the popup spans nearly the full viewport width, matching native iOS behavior.
   *
   * When `modal` is `true`, focus trapping is enabled only if `<Popover.Close>` is rendered
   * inside `<Popover.Popup>`. It can be visually hidden with your own CSS if needed.
   *
   * When `modal` is `'trap-focus'`, render `<Popover.Close>` inside `<Popover.Popup>` so touch
   * screen readers can escape the popup.
   * @default false
   */
  modal?: boolean | 'trap-focus' | undefined;
  /**
   * ID of the trigger that the popover is associated with.
   * This is useful in conjunction with the `open` prop to create a controlled popover.
   * There's no need to specify this prop when the popover is uncontrolled (that is, when the `open` prop is not set).
   */
  triggerId?: string | null | undefined;
  /**
   * ID of the trigger that the popover is associated with.
   * This is useful in conjunction with the `defaultOpen` prop to create an initially open popover.
   */
  defaultTriggerId?: string | null | undefined;
  /**
   * A handle to associate the popover with a trigger.
   * If specified, allows external triggers to control the popover's open state.
   */
  handle?: PopoverHandle<Payload> | undefined;
}

export interface PopoverRootActions {
  /**
   * Ends the closing phase of the popover after an exit animation that code outside the library
   * runs. Call `preventUnmountOnClose()` in `openChange` first. If not, the popover completes its
   * close itself. `keepMounted` of the portal decides if the popup leaves the DOM.
   */
  unmount: () => void;
  /**
   * Closes the popover.
   */
  close: () => void;
}

export type PopoverRootChangeEventReason =
  | typeof REASONS.triggerHover
  | typeof REASONS.triggerFocus
  | typeof REASONS.triggerPress
  | typeof REASONS.outsidePress
  | typeof REASONS.escapeKey
  | typeof REASONS.closePress
  | typeof REASONS.focusOut
  | typeof REASONS.imperativeAction
  | typeof REASONS.none;

export type PopoverRootChangeEventDetails =
  VaseUIChangeEventDetails<PopoverRootChangeEventReason> & {
    /** Prevents the popup from unmounting until the `unmount` action is called. */
    preventUnmountOnClose: () => void;
  };
</script>

<script setup lang="ts" generic="Payload = unknown">
import { onScopeDispose, provide, watch } from 'vue';
import { useDismiss } from '../../utils/popups/interactions/useDismiss';
import { usePopupRoot, usePopupRootSync } from '../../utils/popups/popupRoot';
import { usePopupInteractionProps } from '../../utils/popups/popupStoreUtils';
import { provideFloatingTree } from '../../utils/popups/tree/FloatingTree';
import { PopoverStore } from '../store/PopoverStore';
import { PopoverRootContext, usePopoverRootContext } from './PopoverRootContext';

const props = withDefaults(defineProps<PopoverRootProps<Payload>>(), {
  open: undefined,
  defaultOpen: false,
  modal: false,
  triggerId: undefined,
  defaultTriggerId: null,
  handle: undefined,
});

const emit = defineEmits<{
  /**
   * Event handler called when the popover is opened or closed.
   */
  openChange: [open: boolean, eventDetails: PopoverRootChangeEventDetails];
  'update:open': [open: boolean];
  /**
   * Event handler called after any animations complete when the popover is opened or closed.
   */
  openChangeComplete: [open: boolean];
}>();

defineSlots<{
  /**
   * The content of the popover. The slot gets the `payload` of the active trigger.
   */
  default(props: { payload: Payload | undefined }): unknown;
}>();

// A root below the root of another popover joins the tree of that popover. A root with no popover
// above it starts a tree, also when a part of another popup family is above it.
const tree = usePopoverRootContext(true) === undefined ? provideFloatingTree() : undefined;

const {
  store,
  open: isOpen,
  payload,
  actions,
} = usePopupRoot(
  props,
  (initialState, defaultPopupId) =>
    new PopoverStore<Payload>({ ...initialState, modal: props.modal }, defaultPopupId),
  {
    name: 'Popover',
    handle: () => props.handle,
    onOpenChange(nextOpen, details) {
      emit('openChange', nextOpen, details);
      if (!details.isCanceled) {
        emit('update:open', nextOpen);
      }
    },
    onOpenChangeComplete(nextOpen) {
      emit('openChangeComplete', nextOpen);
    },
  },
);

onScopeDispose(store.context.stickIfOpenTimeout.clear);

usePopupRootSync(store, isOpen);

watch(
  () => props.modal,
  (modal) => store.set('modal', modal),
);

watch(isOpen, (openNow) => {
  if (!openNow) {
    store.context.stickIfOpenTimeout.clear();
  }
});

const dismiss = useDismiss(store, {
  // With `'sloppy'`, a press outside a popup that traps the focus removes `aria-hidden` from the
  // elements outside at once.
  outsidePressEvent: () => ({
    mouse: props.modal === 'trap-focus' ? 'sloppy' : 'intentional',
    touch: 'sloppy',
  }),
  externalTree: tree,
});

// `Popover.Popup` has the props of a popup that can take the focus itself. The popup props of the
// store thus hold only the dismiss handlers.
usePopupInteractionProps(store, () => ({
  activeTriggerProps: dismiss.reference,
  inactiveTriggerProps: dismiss.reference,
  popupProps: dismiss.floating,
}));

provide(PopoverRootContext, store);

defineExpose(actions);
</script>

<template>
  <slot :payload="payload" />
</template>
