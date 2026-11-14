import { watch } from 'vue';
import { useFloatingParentNodeId, useFloatingTree } from '../../utils/popups/tree/FloatingTree';
import { getNodeAncestors } from '../../utils/popups/tree/nodes';

/**
 * React sends an event of a popup in a portal to the parent popup through the React tree. Vue sends
 * the event of a teleported popup only to its own DOM ancestors. A popup in a filterable menu thus
 * gives these events to the popup tree, and the popups above it listen to the tree.
 */
export const NESTED_FOCUSIN = 'nestedfocusin';
export const NESTED_KEYDOWN = 'nestedkeydown';

interface NestedPopupEventDetails {
  /** The node of the popup that got the event. */
  nodeId: string | null;
  event: Event;
}

/**
 * Gives an event of the popup of this part to the popup tree. Call it in `setup` of the popup.
 *
 * @returns The function that gives an event to the tree.
 */
export function useNestedPopupEventSender() {
  const tree = useFloatingTree();
  const nodeId = useFloatingParentNodeId();

  return function sendToParents(name: string, event: Event) {
    const details: NestedPopupEventDetails = { nodeId: nodeId.value, event };
    tree.value?.events.emit(name, details);
  };
}

/**
 * Calls `listener` for each event that a popup below the popup of this part gives to the tree. The
 * events of the popup itself and of a popup beside it do not reach the listener. Call it in `setup`
 * of a part in the popup.
 */
export function useNestedPopupEventListener<E extends Event>(
  name: string,
  listener: (event: E) => void,
) {
  const tree = useFloatingTree();
  const nodeId = useFloatingParentNodeId();

  watch(
    tree,
    (currentTree, _previous, onCleanup) => {
      if (currentTree === null) {
        return;
      }

      function handleNestedPopupEvent(details: NestedPopupEventDetails) {
        const ancestors = getNodeAncestors(
          currentTree?.nodesRef.value ?? [],
          details.nodeId ?? undefined,
        );
        if (nodeId.value !== null && ancestors.some((node) => node.id === nodeId.value)) {
          listener(details.event as E);
        }
      }

      currentTree.events.on(name, handleNestedPopupEvent);
      onCleanup(() => currentTree.events.off(name, handleNestedPopupEvent));
    },
    { immediate: true },
  );
}
