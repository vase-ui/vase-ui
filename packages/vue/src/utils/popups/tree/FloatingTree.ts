import {
  computed,
  inject,
  onActivated,
  onBeforeMount,
  onDeactivated,
  onScopeDispose,
  provide,
  toValue,
  useId,
  watch,
} from 'vue';
import type { ComputedRef, InjectionKey, MaybeRefOrGetter } from 'vue';
import type { FloatingNodeType, FloatingTreeType, PopupPositioningContext } from '../types';
import { FloatingTreeStore } from './FloatingTreeStore';

const FloatingNodeContext: InjectionKey<ComputedRef<string | undefined>> = Symbol();
const FloatingTreeContext: InjectionKey<ComputedRef<FloatingTreeType>> = Symbol();

// A node of `useFloatingNodeId` hides its context while its part is deactivated. This map gives the
// slot that holds the context with no hiding.
const nodeSlots = new WeakMap<FloatingNodeType, Pick<FloatingNodeType, 'context'>>();

/**
 * Removes `context` from `node`, only when the node holds this context. The node can hold the
 * context of a newer popup, and that context stays. It also works for the node of a deactivated
 * part.
 */
export function removeNodeContext(node: FloatingNodeType, context: PopupPositioningContext): void {
  const slot = nodeSlots.get(node) ?? node;
  if (slot.context === context) {
    slot.context = undefined;
  }
}

/**
 * Returns the parent node id for nested floating elements, if available.
 * Returns `null` for top-level floating elements.
 */
export function useFloatingParentNodeId(): ComputedRef<string | null> {
  const parentNodeId = inject(FloatingNodeContext, null);
  return computed(() => parentNodeId?.value || null);
}

/**
 * Returns the nearest floating tree context, if available.
 */
export function useFloatingTree(
  externalTree?: MaybeRefOrGetter<FloatingTreeStore | undefined>,
): ComputedRef<FloatingTreeType | null> {
  const contextTree = inject(FloatingTreeContext, null);
  return computed(() => toValue(externalTree) ?? contextTree?.value ?? null);
}

/**
 * Registers a node into the `FloatingTree`, returning its id.
 * @see https://floating-ui.com/docs/FloatingTree
 */
export function useFloatingNodeId(
  externalTree?: MaybeRefOrGetter<FloatingTreeStore | undefined>,
): string {
  const id = useId();
  const tree = useFloatingTree(externalTree);
  const parentId = useFloatingParentNodeId();

  const slot: Pick<FloatingNodeType, 'context'> = {};
  let deactivated = false;
  const node: FloatingNodeType = {
    id,
    get parentId() {
      return parentId.value;
    },
    // `KeepAlive` runs its hooks from the last part to the first part. A hook that adds the node
    // again thus changes the place of the node. The node stays, and a reader ignores a node with
    // no context.
    get context() {
      return deactivated ? undefined : slot.context;
    },
    set context(value) {
      slot.context = value;
    },
  };
  nodeSlots.set(node, slot);

  let registeredTree: FloatingTreeType | null = null;
  function register(nextTree: FloatingTreeType | null) {
    if (registeredTree === nextTree) {
      return;
    }
    registeredTree?.removeNode(node);
    registeredTree = nextTree;
    nextTree?.addNode(node);
  }

  // A server render does not call this hook, so a tree that a module makes gets no node there.
  // The hook runs before the `setup` of the parts below. Each of them then finds the node when it
  // is mounted.
  onBeforeMount(() => register(tree.value));
  watch(tree, register);
  onScopeDispose(() => register(null));
  onDeactivated(() => {
    deactivated = true;
  });
  onActivated(() => {
    deactivated = false;
  });

  return id;
}

/**
 * Provides parent node context for nested floating elements.
 * @see https://floating-ui.com/docs/FloatingTree
 */
export function provideFloatingNode(id: MaybeRefOrGetter<string | undefined>): void {
  provide(
    FloatingNodeContext,
    computed(() => toValue(id)),
  );
}

/**
 * Provides context for nested floating elements when they are not children of
 * each other on the DOM.
 * This is not necessary in all cases, except when there must be explicit communication between parent and child floating elements. It is necessary for:
 * - The `bubbles` option in the `useDismiss()` Hook
 * - Nested virtual list navigation
 * - Nested floating elements that each open on hover
 * - Custom communication between parent and child floating elements
 *
 * `externalTree` is a store, a ref or a getter, and the parts below follow a change of it. With no
 * tree, the part provides one tree of its own.
 * @see https://floating-ui.com/docs/FloatingTree
 */
export function provideFloatingTree(
  externalTree?: MaybeRefOrGetter<FloatingTreeStore | undefined>,
): ComputedRef<FloatingTreeStore> {
  const ownTree = new FloatingTreeStore();
  const tree = computed(() => toValue(externalTree) ?? ownTree);
  provide(FloatingTreeContext, tree);
  return tree;
}
