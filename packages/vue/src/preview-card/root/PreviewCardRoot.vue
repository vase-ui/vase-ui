<script lang="ts">
import type { VaseUIChangeEventDetails } from '../../internals/createBaseUIEventDetails';
import type { REASONS } from '../../internals/reasons';
import type { PreviewCardHandle } from '../store/PreviewCardHandle';

export interface PreviewCardRootState {}

export interface PreviewCardRootProps<Payload = unknown> {
  /**
   * Whether the preview card is initially open.
   *
   * To render a controlled preview card, use the `open` prop instead.
   * @default false
   */
  defaultOpen?: boolean | undefined;
  /**
   * Whether the preview card is currently open.
   */
  open?: boolean | undefined;
  /**
   * A handle to associate the preview card with a trigger.
   * If specified, allows external triggers to control the card's open state.
   * Can be created with the PreviewCard.createHandle() method.
   */
  handle?: PreviewCardHandle<Payload> | undefined;
  /**
   * ID of the trigger that the preview card is associated with.
   * This is useful in conjunction with the `open` prop to create a controlled preview card.
   * There's no need to specify this prop when the preview card is uncontrolled (that is, when the `open` prop is not set).
   */
  triggerId?: string | null | undefined;
  /**
   * ID of the trigger that the preview card is associated with.
   * This is useful in conjunction with the `defaultOpen` prop to create an initially open preview card.
   */
  defaultTriggerId?: string | null | undefined;
}

export interface PreviewCardRootActions {
  /**
   * Ends the closing phase of the preview card after an externally controlled closing animation finishes.
   * Call `preventUnmountOnClose()` in `openChange` first, otherwise the preview card completes closing on its own.
   * Whether it leaves the DOM is decided by `keepMounted` on the portal.
   */
  unmount: () => void;
  /**
   * Closes the preview card imperatively when called.
   */
  close: () => void;
}

export type PreviewCardRootChangeEventReason =
  | typeof REASONS.triggerHover
  | typeof REASONS.triggerFocus
  | typeof REASONS.triggerPress
  | typeof REASONS.outsidePress
  | typeof REASONS.escapeKey
  | typeof REASONS.imperativeAction
  | typeof REASONS.none;

export type PreviewCardRootChangeEventDetails =
  VaseUIChangeEventDetails<PreviewCardRootChangeEventReason> & {
    /** Prevents the popup from unmounting until the `unmount` action is called. */
    preventUnmountOnClose: () => void;
  };
</script>

<script setup lang="ts" generic="Payload = unknown">
import { provide, watch } from 'vue';
import { useDismiss } from '../../utils/popups/interactions/useDismiss';
import { usePopupRoot } from '../../utils/popups/popupRoot';
import { usePopupInteractionProps } from '../../utils/popups/popupStoreUtils';
import { provideFloatingTree } from '../../utils/popups/tree/FloatingTree';
import { PreviewCardStore } from '../store/PreviewCardStore';
import { PreviewCardRootContext, usePreviewCardRootContext } from './PreviewCardContext';

// A root inside another root uses the tree of that root. A component cannot inject a value that it
// provides, so the outer root gives its own tree to `useDismiss`.
const tree = usePreviewCardRootContext(true) ? undefined : provideFloatingTree();

const props = withDefaults(defineProps<PreviewCardRootProps<Payload>>(), {
  open: undefined,
  defaultOpen: false,
  handle: undefined,
  triggerId: undefined,
  defaultTriggerId: null,
});

const emit = defineEmits<{
  /**
   * Event handler called when the preview card is opened or closed.
   */
  openChange: [open: boolean, eventDetails: PreviewCardRootChangeEventDetails];
  'update:open': [open: boolean];
  /**
   * Event handler called after any animations complete when the preview card is opened or closed.
   */
  openChangeComplete: [open: boolean];
}>();

defineSlots<{
  /**
   * The content of the preview card. The slot gets the `payload` of the active trigger.
   */
  default(props: { payload: Payload | undefined }): unknown;
}>();

const {
  store,
  open: isOpen,
  payload,
  actions,
} = usePopupRoot(
  props,
  (initialState, defaultPopupId) => new PreviewCardStore<Payload>(initialState, defaultPopupId),
  {
    name: 'PreviewCard',
    closeOnActiveTriggerUnmount: true,
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

watch([isOpen, () => store.select('activeTriggerId')], ([openNow, activeTriggerId]) => {
  if (openNow && activeTriggerId == null) {
    store.set('payload', undefined);
  }
});

const dismiss = useDismiss(store, { externalTree: tree });
usePopupInteractionProps(store, () => ({
  activeTriggerProps: dismiss.reference,
  inactiveTriggerProps: dismiss.trigger,
  popupProps: dismiss.floating,
}));

provide(PreviewCardRootContext, store);

defineExpose(actions);
</script>

<template>
  <slot :payload="payload" />
</template>
