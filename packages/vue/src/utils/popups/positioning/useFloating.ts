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
  FloatingNodeType,
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
   * composable. A popup that can move to the node of another part, such as the node of a detached
   * trigger, gives a ref or a getter. The context then moves to the new node.
   */
  nodeId?: MaybeRefOrGetter<string | undefined>;
  /**
   * The tree to use when the tree of the context cannot reach the part.
   */
  externalTree?: MaybeRefOrGetter<FloatingTreeStore | undefined>;
}

/**
 * Makes the positioning context of a popup. It gives the context to the store and to the node of
 * the popup in the popup tree, where the interaction composables and the other popups read it.
 *
 * The context is one plain object. `open` is the state of the last DOM update. Each other member
 * that can change is a getter, so a read gives the current value.
 *
 * Call it in `setup`, after `useAnchorPositioning`.
 * @see https://floating-ui.com/docs/useFloating
 */
export function useVaseUIFloating(options: UseFloatingOptions): PopupPositioningContext {
  const { positioning } = options;

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
    open: rootStore.value.select('open'),
    get placement() {
      return positioning.placement.value;
    },
    get nodeId() {
      return toValue(options.nodeId);
    },
    elements,
    get rootStore() {
      return rootStore.value;
    },
  };

  // A popup above reads `open` in the event in which this popup closes, and it must still see this
  // popup as open. A getter that reads the store would give `false` there.
  watch(
    () => rootStore.value.select('open'),
    (open) => {
      context.open = open;
    },
    { flush: 'post' },
  );

  let published: PositioningInteractionStore | null = null;
  let publishedNode: FloatingNodeType | undefined;
  let deactivated = false;

  function unpublish() {
    if (published?.context.positioning === context) {
      published.context.positioning = undefined;
    }
    published = null;
  }

  function unpublishNode() {
    if (publishedNode?.context === context) {
      publishedNode.context = undefined;
    }
    publishedNode = undefined;
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

    const nodeId = toValue(options.nodeId);
    const node =
      deactivated || nodeId === undefined
        ? undefined
        : tree.value?.nodesRef.value.find((candidate) => candidate.id === nodeId);
    if (node !== publishedNode) {
      unpublishNode();
      publishedNode = node;
    }
    if (node) {
      node.context = context;
    }
  }

  // A server does not call `onBeforeMount`, so a server render writes nothing. The hook runs before
  // the `setup` of the parts below, so each of them finds the context.
  onBeforeMount(publish);
  watch([rootStore, () => tree.value?.nodesRef.value, () => toValue(options.nodeId)], publish);
  onScopeDispose(() => {
    unpublish();
    unpublishNode();
  });

  // The tree hides the context of a node only while the part of that node is deactivated. This
  // popup can use the node of a part that stays active, so the node and the store lose the context
  // here.
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
