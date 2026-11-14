import { isHTMLElement } from '@floating-ui/utils/dom';
import { provide, watch } from 'vue';
import { ownerDocument } from '../../common/owner';
import { activeElement, contains } from '../../common/shadowDom';
import { createChangeEventDetails } from '../../internals/createBaseUIEventDetails';
import { useDirection } from '../../internals/direction-context/DirectionContext';
import { REASONS } from '../../internals/reasons';
import type { VaseUIEvent } from '../../internals/types';
import { stopEvent } from '../../utils/popups/event';
import {
  isCrossOrientationCloseKey,
  isCrossOrientationOpenKey,
  isMainOrientationKey,
} from '../../utils/popups/interactions/useListNavigation';
import type { MenuFilterRoot, MenuFilterRootOptions } from '../filter-root/MenuFilterRoot';
import { moveHighlightFrom } from '../filter-root/moveHighlightFrom';
import { useMenuFilterRoot } from '../filter-root/useMenuFilterRoot';
import type { MenuRootChangeEventDetails } from '../root/MenuRoot.vue';
import { useMenuRootContext } from '../root/MenuRootContext';
import type { MenuRootContext } from '../root/MenuRootContext';
import type { UseMenuRootOptions } from '../root/useMenuRoot';
import { MenuSubmenuRootContext } from '../submenu-root/MenuSubmenuRootContext';
import { isKeyboardOpen } from '../utils/isKeyboardOpen';

interface ParentReference {
  reference: HTMLElement;
  trigger: HTMLElement;
}

/**
 * The work that a filterable `Menu.SubmenuRoot` does in addition to the work of a plain one. The
 * provider gives it to the submenu root directly inside it. Only the provider imports the code
 * behind it, so a plain menu never bundles it.
 */
export interface MenuFilterSubmenuRoot {
  /** The options of `useMenuRoot` that a filterable submenu sets. */
  rootOptions: MenuFilterRoot['rootOptions'] & Pick<UseMenuRootOptions, 'disabled'>;
  /**
   * Runs after the submenu root reported the open change. It follows what the keyboard and the
   * pointer do to the focus and the highlight of the parent menu.
   */
  onOpenChange: (nextOpen: boolean, details: MenuRootChangeEventDetails) => void;
  /**
   * Provides the filter and the navigation to the parts of the submenu. The root calls it with
   * the context that `useMenuRoot` returned, because a component cannot inject what it provides.
   */
  provideDropdown: (context: MenuRootContext) => void;
}

/**
 * Makes a submenu filterable. It also moves the focus and the highlight between the parent menu
 * and the submenu with the keys of both orientations. Call it in the `setup` of
 * `Menu.SubmenuRoot`, through the provider.
 */
export function useMenuFilterSubmenuRoot(options: MenuFilterRootOptions): MenuFilterSubmenuRoot {
  const parent = useMenuRootContext();
  const parentStore = parent.store;
  const filterRoot = useMenuFilterRoot(options);

  let parentReference: ParentReference | null = null;

  function handleSubmenuEnter(trigger: HTMLElement, event: Event | undefined) {
    const focusedElement = parent.virtualFocus
      ? parentStore.context.virtualFocusRef?.value
      : activeElement(ownerDocument(trigger));

    if (isHTMLElement(focusedElement)) {
      parentReference = { reference: focusedElement, trigger };
      parentStore.setActiveIndex(null, event ? REASONS.keyboard : REASONS.none, event);
    }
  }

  function highlightTrigger(trigger: HTMLElement, event: Event | undefined) {
    parentStore.highlightItem(trigger, REASONS.keyboard, event);
  }

  function handleSubmenuExit(event: Event) {
    if (!parentReference) {
      return;
    }

    parentReference.reference.focus({ preventScroll: true });
    highlightTrigger(parentReference.trigger, event);
  }

  function getReturnElement() {
    return (
      parentReference?.reference ??
      (parent.virtualFocus ? parentStore.context.virtualFocusRef?.value : null) ??
      null
    );
  }

  return {
    rootOptions: { ...filterRoot.rootOptions, disabled: () => parentStore.select('disabled') },
    onOpenChange(nextOpen, details) {
      if (details.isCanceled) {
        return;
      }

      if (!nextOpen) {
        if (details.reason === REASONS.escapeKey && isHTMLElement(details.trigger)) {
          highlightTrigger(details.trigger, details.event);
          // `Menu.Popup` returns the focus with `getReturnElement`, so point it at the element
          // that can hold real focus: the input of the parent, not its trigger, which the focus
          // cannot reach.
          parentReference = {
            reference: parent.virtualFocus
              ? (parentStore.context.virtualFocusRef?.value ?? details.trigger)
              : details.trigger,
            trigger: details.trigger,
          };
        }
        return;
      }

      parentReference = null;
      if (isHTMLElement(details.trigger) && isKeyboardOpen(details.reason, details.event)) {
        // A keyboard click reports its click, which is not the key that opened the submenu.
        handleSubmenuEnter(
          details.trigger,
          details.reason === REASONS.listNavigation ? details.event : undefined,
        );
      }
    },
    provideDropdown(context) {
      filterRoot.provideDropdown(context);

      const { store, orientation } = context;
      const direction = useDirection();

      function handleReturnFocus() {
        // A plain parent has no input to return to. Focus the trigger that this submenu opened
        // from, as a plain submenu does, so that a hover close does not leave the focus on the
        // body.
        const [ownTrigger] = store.context.triggerElements.elements();
        return getReturnElement() ?? (isHTMLElement(ownTrigger) ? ownTrigger : null);
      }

      // A hover close makes the focus manager skip its return focus, which would leave the focus
      // of the input of the submenu on the body once the popup unmounts.
      watch(
        () => store.select('mounted'),
        (mounted, wasMounted) => {
          if (mounted || !wasMounted) {
            return;
          }

          const returnElement = handleReturnFocus();
          if (!returnElement || !parentStore.select('open')) {
            return;
          }
          const doc = ownerDocument(returnElement);
          const activeEl = activeElement(doc);
          if (activeEl === doc.body || contains(store.select('popupElement'), activeEl)) {
            returnElement.focus({ preventScroll: true });
          }
        },
        { flush: 'post' },
      );

      function moveInParent(from: HTMLElement, event: KeyboardEvent) {
        const item = moveHighlightFrom(parentStore, from, event, {
          orientation: parent.orientation.value,
          rtl: direction.value === 'rtl',
          loopFocus: parent.loopFocus.value,
          allowEscape: parent.virtualFocus && parent.allowEscape.value,
        });
        if (!parent.virtualFocus) {
          item?.focus({ preventScroll: true });
        }
      }

      function close(event: KeyboardEvent) {
        if (!store.select('open')) {
          return;
        }

        // The key can reach this popup sent again on its highlighted item, so it cannot be left to
        // bubble to the parent. A close key that also moves the highlight of the parent moves it
        // from here.
        stopEvent(event);
        const trigger = store.select('activeTriggerElement');

        const eventDetails = createChangeEventDetails(REASONS.listNavigation, event);
        store.setOpen(false, eventDetails);

        if (!eventDetails.isCanceled) {
          handleSubmenuExit(event);
        }

        // `handleSubmenuExit` does nothing when the pointer opened the submenu, so return the
        // focus here.
        const returnElement = getReturnElement() ?? store.select('activeTriggerElement');
        if (
          !store.select('open') &&
          isHTMLElement(returnElement) &&
          activeElement(ownerDocument(returnElement)) !== returnElement
        ) {
          returnElement.focus();
        }

        if (
          !store.select('open') &&
          isHTMLElement(trigger) &&
          isMainOrientationKey(event.key, parent.orientation.value)
        ) {
          moveInParent(trigger, event);
        }
      }

      function handleTriggerKeydown(event: VaseUIEvent<KeyboardEvent>) {
        const trigger = event.currentTarget as HTMLElement;
        if (isMainOrientationKey(event.key, parent.orientation.value)) {
          moveInParent(trigger, event);
          event.preventVaseUIHandler();
          stopEvent(event);
          return;
        }

        const open = store.select('open');
        const isRtl = direction.value === 'rtl';
        const isCloseKey = isCrossOrientationCloseKey(event.key, orientation.value, isRtl, false);

        if (open && isCloseKey) {
          close(event);
          return;
        }

        const isOpenKey = isCrossOrientationOpenKey(event.key, parent.orientation.value, isRtl);
        if (!isOpenKey) {
          return;
        }

        stopEvent(event);

        if (open) {
          // Entering a submenu that is already open gives the cursor to its own focus owner. The
          // submenu always has virtual focus, so it has no branch of roving focus. The highlight
          // stays, so an automatic highlight or an earlier keyboard position stays after the
          // entry.
          handleSubmenuEnter(trigger, event);
          store.context.virtualFocusRef?.value?.focus({ preventScroll: true });
          return;
        }

        store.setOpen(true, createChangeEventDetails(REASONS.listNavigation, event, trigger));
      }

      function handlePopupKeydown(event: KeyboardEvent) {
        // A key that composes text in the input must not close the submenu.
        // eslint-disable-next-line @typescript-eslint/no-deprecated -- Base UI reads `which` to find the key of an IME composition.
        if (event.which === 229) {
          return;
        }
        if (
          isCrossOrientationCloseKey(event.key, orientation.value, direction.value === 'rtl', false)
        ) {
          close(event);
        }
      }

      provide(MenuSubmenuRootContext, {
        getReturnElement: handleReturnFocus,
        onTriggerKeydown: handleTriggerKeydown,
        onPopupKeydown: handlePopupKeydown,
      });
    },
  };
}
