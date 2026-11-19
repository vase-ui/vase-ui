import { onMounted, onScopeDispose, provide, shallowRef, toRaw, watch } from 'vue';
import { isElement } from '@floating-ui/utils/dom';
import { contains, getTarget } from '../../common/shadowDom';
import { useScrollLock } from '../../common/useScrollLock';
import { createIdRegistry } from '../../internals/labelable-provider/createIdRegistry';
import { useKeepAliveState } from '../../internals/useKeepAliveState';
import { dismissPopupBindings, dismissTriggerBindings, useDismissLayer } from '../../utils/popups/interactions/useDismissLayer';
import { popupStoreSelectors, usePopupRoot, usePopupRootSync } from '../../utils/popups/usePopupRoot';
import { DialogStore } from '../store/DialogStore';

import type { DialogRootChangeEventDetails, DialogRootProps } from './DialogRoot.vue';
import { DialogRootContext, useDialogRootContext } from './DialogRootContext';

type DialogRootMode = 'dialog' | 'drawer' | 'alert-dialog';

const ROOT_NAMES: Record<DialogRootMode, string> = {
  dialog: 'DialogRoot',
  'alert-dialog': 'AlertDialogRoot',
  drawer: 'DrawerRoot',
};

interface DialogRootEmit {
  (event: 'openChange', open: boolean, eventDetails: DialogRootChangeEventDetails): void;
  (event: 'update:open', open: boolean): void;
  // eslint-disable-next-line @typescript-eslint/unified-signatures -- vue-tsc types the emit function with one signature for each event. A signature for two events does not accept that function.
  (event: 'openChangeComplete', open: boolean): void;
}

/**
 * Does what the roots of Dialog, Alert Dialog and Drawer do. Call it in `setup` of the root. The
 * part exposes `actions` and renders `<slot :payload="payload" />`.
 */
export function useDialogRoot<Payload>(
  mode: DialogRootMode,
  props: DialogRootProps<Payload>,
  emit: DialogRootEmit,
) {
  const isDrawer = mode === 'drawer';
  const isAlertDialog = mode === 'alert-dialog';
  const role: 'dialog' | 'alertdialog' = isAlertDialog ? 'alertdialog' : 'dialog';

  const parentStore = useDialogRootContext(true);
  const nested = parentStore != null;
  const rootState = () => ({
    modal: isAlertDialog ? true : (props.modal ?? true),
    disablePointerDismissal: isAlertDialog || (props.disablePointerDismissal ?? false),
    nested,
    role,
  });

  const owner = usePopupRoot(
    props,
    (initialState, defaultPopupId) =>
      new DialogStore<Payload>({ ...initialState, ...rootState() }, defaultPopupId),
    {
      name: ROOT_NAMES[mode],
      handle: () => props.handle,
      onOpenChange(nextOpen, eventDetails) {
        emit('openChange', nextOpen, eventDetails);
        if (!eventDetails.isCanceled) {
          emit('update:open', nextOpen);
        }
      },
      onOpenChangeComplete(nextOpen) {
        emit('openChangeComplete', nextOpen);
      },
    },
  );

  const { store, open, mounted, payload, actions, bindParts } = owner;
  const parentContext = parentStore?.context;
  watch(rootState, (values) => store.update(values));

  usePopupRootSync(store, open);

  provide(DialogRootContext, store as DialogStore<unknown>);

  const ownNestedOpenDialogs = shallowRef(0);
  const ownNestedOpenDrawers = shallowRef(0);
  const isTopmost = () => ownNestedOpenDialogs.value === 0;

  const dismiss = useDismissLayer(store, {
    outsidePressEvent() {
      if (store.context.internalBackdropRef.value || store.context.backdropRef.value) {
        return 'intentional';
      }
      // Ensure `aria-hidden` on outside elements is removed immediately
      // on outside press when trapping focus.
      return {
        mouse: store.state.modal === 'trap-focus' ? 'sloppy' : 'intentional',
        touch: 'sloppy',
      };
    },
    outsidePress(event) {
      if (!store.context.outsidePressEnabledRef.value) {
        return false;
      }

      // For mouse events, only accept left button (button 0)
      // For touch events, a single touch is equivalent to left button
      if ('button' in event && event.button !== 0) {
        return false;
      }
      if ('touches' in event) {
        // Outside press can be handled on `touchend`, where the lifted point is
        // reported in `changedTouches` and `touches` contains any remaining
        // active points. Treat it as a single-finger tap only when exactly one
        // touch ended and no other fingers are still down.
        if (event.type === 'touchend') {
          if (event.changedTouches.length !== 1 || event.touches.length !== 0) {
            return false;
          }
        } else if (event.touches.length !== 1) {
          return false;
        }
      }

      const { disablePointerDismissal, modal, popupElement } = toRaw(store.state);
      const target = getTarget(event) as Element | null;
      if (isTopmost() && !disablePointerDismissal) {
        // Only close if the click occurred on the dialog's owning backdrop.
        // This supports multiple modal dialogs that aren't nested in the component tree:
        // https://github.com/mui/base-ui/issues/1320
        if (modal) {
          const internalBackdrop = store.context.internalBackdropRef.value;
          const backdrop = store.context.backdropRef.value;
          return internalBackdrop || backdrop
            ? internalBackdrop === target ||
                backdrop === target ||
                // `target` can be the document, which contains the popup but isn't an element.
                (contains(target, popupElement) &&
                  !(isElement(target) && target.hasAttribute('data-vase-ui-portal')))
            : true;
        }
        return true;
      }
      return false;
    },
    escapeKey: isTopmost,
  });

  useScrollLock(
    () => open.value && store.state.modal === true,
    () => store.state.popupElement,
  );

  // Listen for nested open/close events on this store to maintain the counts.
  // A close notification is an open notification with zeroed counts.
  store.context.onNestedDialogOpen = (dialogCount, drawerCount) => {
    // A handle-backed root keeps these interactions mounted while closed. Ignore nested roots that
    // open meanwhile so their counts don't carry into the next open session.
    const state = toRaw(store.state);
    if (!popupStoreSelectors.open(state) && !state.mounted) {
      return;
    }
    ownNestedOpenDialogs.value = dialogCount;
    ownNestedOpenDrawers.value = drawerCount;
  };

  watch([open, mounted], ([isOpen, isMounted]) => {
    if (!isOpen && !isMounted) {
      ownNestedOpenDialogs.value = 0;
      ownNestedOpenDrawers.value = 0;
    }
  });

  // `KeepAlive` takes the popup of a deactivated dialog out of the document, so the dialog above
  // must not count it.
  const { isHeld } = useKeepAliveState();
  let hasReported = false;

  // Notify parent of our open/close state using parent callbacks, if any
  function reportToParent() {
    const onNestedDialogOpen = parentContext?.onNestedDialogOpen;
    if (!onNestedDialogOpen) {
      return;
    }
    if (open.value && !isHeld.value) {
      hasReported = true;
      onNestedDialogOpen(
        ownNestedOpenDialogs.value + 1,
        ownNestedOpenDrawers.value + (isDrawer ? 1 : 0),
      );
    } else if (hasReported) {
      hasReported = false;
      onNestedDialogOpen(0, 0);
    }
  }

  onMounted(() => {
    watch([open, ownNestedOpenDialogs, ownNestedOpenDrawers, isHeld], reportToParent, { immediate: true });
  });
  onScopeDispose(() => {
    if (hasReported) {
      parentContext?.onNestedDialogOpen?.(0, 0);
    }
  });

  // Each registry keeps the ids of the parts of one kind, so the popup keeps its name when one of
  // two titles unmounts. A part that writes its own id to the store would clear that name when it
  // unmounts.
  const titleIds = createIdRegistry();
  const descriptionIds = createIdRegistry();
  store.context.registerTitleId = titleIds.registerId;
  store.context.registerDescriptionId = descriptionIds.registerId;
  watch(
    () => [titleIds.ids.value.at(-1), descriptionIds.ids.value.at(-1)] as const,
    ([titleElementId, descriptionElementId]) => {
      store.update({ titleElementId, descriptionElementId });
    },
  );

  bindParts({ trigger: () => dismissTriggerBindings(dismiss), popup: () => dismissPopupBindings(dismiss) });
  watch(
    [ownNestedOpenDialogs, ownNestedOpenDrawers],
    ([nestedOpenDialogCount, nestedOpenDrawerCount]) => {
      store.update({ nestedOpenDialogCount, nestedOpenDrawerCount });
    },
    { immediate: true },
  );
  return { store, payload, actions };
}
