import {
  computed,
  onActivated,
  onDeactivated,
  onMounted,
  onScopeDispose,
  shallowRef,
  toValue,
  watch,
} from 'vue';
import type { MaybeRefOrGetter, WatchSource } from 'vue';
import { isElement } from '@floating-ui/utils/dom';
import { addEventListener } from '../../../common/addEventListener';
import { mergeCleanups } from '../../../common/mergeCleanups';
import { useTimeout } from '../../../common/useTimeout';
import { createChangeEventDetails } from '../../../internals/createBaseUIEventDetails';
import { REASONS } from '../../../internals/reasons';
import { useFloatingParentNodeId, useFloatingTree } from '../tree/FloatingTree';
import type { PopupInteractionStore } from '../types';
import { getNodeChildren } from '../tree/nodes';
import { getHoverIntent } from './hoverIntent';
import type { HoverIntent } from './hoverIntent';

export interface UseHoverPopupInteractionProps {
  /**
   * Whether the composable is enabled, including all its watchers and listeners.
   * @default true
   */
  enabled?: MaybeRefOrGetter<boolean | undefined>;
  /**
   * Waits for the specified time after the pointer leaves the popup before it changes the `open`
   * state.
   * @default 0
   */
  closeDelay?: MaybeRefOrGetter<number | undefined>;
  /**
   * Tree node id override for floating elements that participate in the tree
   * without a `PopupPositioningContext`, such as inline nested navigation menus.
   */
  nodeId?: MaybeRefOrGetter<string | undefined>;
}

/**
 * Runs `run` at mount and after each DOM update that follows a change of `sources`. The cleanup
 * that `run` returns runs before the next run and when the part unmounts. A server calls no
 * `onMounted` hook and runs no such `watch`, so `run` reads nothing there.
 */
function useDomEffect(sources: WatchSource[], run: () => (() => void) | void) {
  let cleanup: (() => void) | undefined;
  function update() {
    cleanup?.();
    cleanup = run() ?? undefined;
  }
  onMounted(update);
  watch(sources, update, { flush: 'post' });
  onScopeDispose(() => cleanup?.());
}

/**
 * Adds the hover interactions of a popup to its positioner element. Call it in `setup`. The store
 * can be a ref or a getter, because a part can get its store after `setup`.
 */
export function useHoverPopupInteraction(
  store: MaybeRefOrGetter<PopupInteractionStore>,
  parameters: UseHoverPopupInteractionProps = {},
): void {
  const enabled = () => toValue(parameters.enabled) ?? true;
  const closeDelay = () => toValue(parameters.closeDelay) ?? 0;

  const open = computed(() => toValue(store).select('open'));
  const positionerElement = computed(() => toValue(store).select('positionerElement'));
  const anchorElement = computed(() => toValue(store).select('anchorElement'));

  const tree = useFloatingTree();
  const parentId = useFloatingParentNodeId();
  // A server render reads the intent in no hook, so it makes none.
  const intent = computed(() => getHoverIntent(toValue(store)));

  const childClosedTimeout = useTimeout();

  // `KeepAlive` takes the popup out of the document and sends it no leave event. While it holds the
  // popup, the popup blocks no pointer events and has no listener on its positioner element.
  const deactivated = shallowRef(false);
  // A source list gets this getter, not the ref: a shallow ref in the list makes `watch` call its
  // callback also when no value of a source changed.
  const isDeactivated = () => deactivated.value;
  onDeactivated(() => {
    deactivated.value = true;
  });
  onActivated(() => {
    deactivated.value = false;
  });

  // A change of the store gives each effect a new intent. The cleanup then stops the old intent,
  // and the effect runs for the new intent.
  function useIntentEffect(
    sources: WatchSource[],
    run: (hoverIntent: HoverIntent) => (() => void) | void,
  ) {
    useDomEffect([intent, ...sources], () => run(intent.value));
  }

  useIntentEffect([open], (hoverIntent) => {
    if (!open.value) {
      hoverIntent.reset();
    }
  });

  // The store owns the intent, and the triggers use it too. While this part is active, it stops
  // what is in flight when it unmounts, when its store changes and when `KeepAlive` deactivates it.
  useIntentEffect([isDeactivated], (hoverIntent) => {
    if (isDeactivated()) {
      return undefined;
    }
    return () => {
      childClosedTimeout.clear();
      hoverIntent.cancelPendingOpen();
      hoverIntent.restoreOutsidePointerEvents();
    };
  });

  useIntentEffect(
    [enabled, open, anchorElement, positionerElement, tree, parentId, isDeactivated],
    (hoverIntent) => {
      if (!enabled() || isDeactivated()) {
        return undefined;
      }

      const anchor = anchorElement.value;
      const positioner = positionerElement.value;
      if (
        open.value &&
        isElement(anchor) &&
        positioner &&
        hoverIntent.blockOutsidePointerEventsForPopup(
          anchor as HTMLElement | SVGSVGElement,
          positioner,
          tree.value,
          parentId.value,
        )
      ) {
        return hoverIntent.restoreOutsidePointerEvents;
      }
      return undefined;
    },
  );

  // The positioner element belongs to another part than the popup part that calls this composable,
  // so its listeners cannot be props.
  useIntentEffect([enabled, positionerElement, tree, parentId, isDeactivated], (hoverIntent) => {
    if (!enabled() || isDeactivated()) {
      return undefined;
    }

    const currentStore = toValue(store);
    const currentTree = tree.value;
    const currentParentId = parentId.value;
    const floating = positionerElement.value;

    function hasParentChildren() {
      return !!(
        currentTree &&
        currentParentId &&
        getNodeChildren(currentTree.nodesRef.value, currentParentId).length > 0
      );
    }

    function onFloatingMouseEnter() {
      hoverIntent.onPopupMouseEnter();
      childClosedTimeout.clear();
      currentTree?.events.off('floating.closed', onNodeClosed);
    }

    function onFloatingMouseLeave(event: MouseEvent) {
      if (hasParentChildren() && currentTree) {
        currentTree.events.on('floating.closed', onNodeClosed);
        return;
      }

      hoverIntent.onPopupMouseLeave(event, {
        closeDelay,
        tree: currentTree,
        nodeId: toValue(parameters.nodeId),
      });
    }

    function onPopupPointerDown(event: PointerEvent) {
      hoverIntent.onPopupPointerDown(event);
    }

    function onNodeClosed(event: MouseEvent) {
      if (!currentTree || !currentParentId) {
        return;
      }
      // The pointer can move into this popup when the popup below it closes, and its `mouseenter`
      // event then cancels this timer. `open` of a node is the state of the last DOM update, so
      // the check for an open popup below it must wait for that update.
      childClosedTimeout.start(0, () => {
        if (hasParentChildren()) {
          return;
        }
        currentTree.events.off('floating.closed', onNodeClosed);
        currentStore.setOpen(false, createChangeEventDetails(REASONS.triggerHover, event));
        currentTree.events.emit('floating.closed', event);
      });
    }

    return mergeCleanups(
      floating && addEventListener(floating, 'mouseenter', onFloatingMouseEnter),
      floating && addEventListener(floating, 'mouseleave', onFloatingMouseLeave),
      floating && addEventListener(floating, 'pointerdown', onPopupPointerDown, true),
      () => {
        currentTree?.events.off('floating.closed', onNodeClosed);
      },
    );
  });
}
