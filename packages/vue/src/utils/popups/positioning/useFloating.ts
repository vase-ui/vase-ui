import {
  computed,
  onActivated,
  onBeforeMount,
  onDeactivated,
  onScopeDispose,
  toValue,
  watch,
} from 'vue';
import type { MaybeRefOrGetter } from 'vue';
import type { UseAnchorPositioningReturnValue } from '../../../internals/useAnchorPositioning';
import { useFloatingTree } from '../tree/FloatingTree';
import type { FloatingTreeStore } from '../tree/FloatingTreeStore';
import type {
  ExtendedElements,
  PopupPositioningContext,
  PositioningInteractionStore,
} from '../types';

export interface UseFloatingOptions {
  /**
   * The store of the popup. It owns the anchor element and the positioner element.
   */
  rootStore: MaybeRefOrGetter<PositioningInteractionStore>;
  /**
   * Whether the popup is mounted. The store forgets its anchor while the popup is not mounted.
   */
  mounted: MaybeRefOrGetter<boolean>;
  /**
   * The return value of `useAnchorPositioning`.
   */
  positioning: Pick<UseAnchorPositioningReturnValue, 'placement' | 'reference'>;
  /**
   * The id of the node of the popup in the popup tree. Call `useFloatingNodeId` before this
   * composable.
   */
  nodeId?: string | undefined;
  /**
   * The tree to use when the tree of the context cannot reach the part.
   */
  externalTree?: MaybeRefOrGetter<FloatingTreeStore | undefined>;
}

/**
 * Makes the positioning context of a popup. It gives the context to the store and to the node of
 * the popup in the popup tree, where the interaction composables and the other popups read it.
 *
 * The context is one plain object that holds getters. A read gives the current value.
 *
 * Call it in `setup`, after `useAnchorPositioning`.
 * @see https://floating-ui.com/docs/useFloating
 */
export function useVaseUIFloating(options: UseFloatingOptions): PopupPositioningContext {
  const { nodeId, positioning } = options;

  const rootStore = computed(() => toValue(options.rootStore));
  const tree = useFloatingTree(options.externalTree);

  const elements: ExtendedElements = {
    get reference() {
      return positioning.reference.value;
    },
    get floating() {
      return rootStore.value.select('positionerElement');
    },
    get domReference() {
      return rootStore.value.select('anchorElement');
    },
  };
  const context: PopupPositioningContext = {
    get open() {
      return rootStore.value.select('open');
    },
    get placement() {
      return positioning.placement.value;
    },
    nodeId,
    elements,
    get rootStore() {
      return rootStore.value;
    },
  };

  let published: PositioningInteractionStore | null = null;
  let deactivated = false;

  function unpublish() {
    if (published?.context.positioning === context) {
      published.context.positioning = undefined;
    }
    published = null;
  }

  function publish() {
    const store = deactivated ? null : rootStore.value;
    if (store !== published) {
      unpublish();
      if (store) {
        store.context.positioning = context;
        published = store;
      }
    }

    const node =
      nodeId === undefined
        ? undefined
        : tree.value?.nodesRef.value.find((candidate) => candidate.id === nodeId);
    if (node) {
      node.context = context;
    }
  }

  // A server does not call `onBeforeMount`, so a server render writes nothing. The hook runs before
  // the `setup` of the parts below, so each of them finds the context.
  onBeforeMount(publish);
  watch([rootStore, () => tree.value?.nodesRef.value], publish);
  onScopeDispose(unpublish);

  // The tree hides the context of a node while `KeepAlive` holds the part. The store does the same.
  onDeactivated(() => {
    deactivated = true;
    publish();
  });
  // `onActivated` also runs at the first mount in a `KeepAlive`.
  onActivated(() => {
    if (deactivated) {
      deactivated = false;
      publish();
    }
  });

  function clearPositioningWhileNotMounted() {
    if (!toValue(options.mounted)) {
      rootStore.value.clearPositioning();
    }
  }

  onBeforeMount(clearPositioningWhileNotMounted);
  watch([rootStore, () => toValue(options.mounted)], clearPositioningWhileNotMounted);

  return context;
}
