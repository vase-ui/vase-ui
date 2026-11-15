import { nextTick, onActivated, onDeactivated, onMounted, shallowRef, toValue, watch } from 'vue';
// eslint-disable-next-line no-restricted-imports -- Vue has no other API that tells a part that it mounts in a branch that `KeepAlive` holds. Vue exports `getCurrentInstance` and types its `parent` and `isDeactivated` fields. A part compiled as a Vapor component gets `false`.
import { getCurrentInstance } from 'vue';
import type { MaybeRefOrGetter, Ref } from 'vue';

// Vue 3.6 types `parent` as an instance of either renderer. Both have these two fields.
interface KeepAliveInstance {
  isDeactivated: boolean;
  parent: KeepAliveInstance | null;
}

/**
 * Whether `KeepAlive` holds the component that calls the function, or a component above it. Call
 * it in `setup`. With no current component, it gives `false` and no warning. Vue reads the same
 * flags before it calls an `onActivated` or `onDeactivated` hook.
 */
export function isInHeldBranch(): boolean {
  for (
    let instance: KeepAliveInstance | null = getCurrentInstance();
    instance;
    instance = instance.parent
  ) {
    if (instance.isDeactivated) {
      return true;
    }
  }
  return false;
}

export interface KeepAliveState {
  /**
   * Whether `KeepAlive` holds the part. A part that mounts in a held branch is held from its mount
   * when its element is not in a document and `reaches` refuses the element.
   */
  isHeld: Readonly<Ref<boolean>>;
  /**
   * Counts the activations by `KeepAlive`. The activation in the flush of the mount does not count.
   */
  shown: Readonly<Ref<number>>;
}

/**
 * Follows the `KeepAlive` state of a part. Call it in `setup`.
 *
 * A part that mounts in a branch that `KeepAlive` holds gets no `onDeactivated` call.
 * `KeepAlive` mounts such a part in a detached element. The part is held when its element is not
 * in a document and `reaches` refuses it. An app that mounts in a detached element is not held,
 * because the owner of the part is in the same tree. A part with no owner calls `isInHeldBranch`
 * in `setup`.
 * @param element The element of the part.
 * @param reaches Whether an id reference of the owner of the registry reaches an element.
 * `isInTreeOf` makes it. Without it, a part that mounts in a held branch is not held.
 */
export function useKeepAliveState(
  element?: MaybeRefOrGetter<Element | null | undefined>,
  reaches?: (element: Element) => boolean,
): KeepAliveState {
  const isHeld = shallowRef(false);
  const shown = shallowRef(0);
  let isMountFlush = false;

  onMounted(() => {
    isMountFlush = true;
    void nextTick(() => {
      isMountFlush = false;
    });

    if (element === undefined || reaches === undefined) {
      return;
    }

    const checkTree = () => {
      const partElement = toValue(element);
      if (partElement && !partElement.isConnected && !reaches(partElement)) {
        isHeld.value = true;
      }
    };

    checkTree();
    // A part can render its element after the mount, such as `Field.Error`. The `watch` starts
    // here and not in `setup`: a `watch` reads its source at once, and a part declares its element
    // after it calls this composable.
    watch(() => toValue(element), checkTree, { flush: 'post' });
  });

  onDeactivated(() => {
    isHeld.value = true;
  });

  // `onActivated` also runs in the flush of the first mount in a `KeepAlive`. A part that mounted
  // in a held branch gets the next call with no `onDeactivated` before it, also when its owner is in
  // that branch.
  onActivated(() => {
    if (isMountFlush) {
      return;
    }
    isHeld.value = false;
    shown.value += 1;
  });

  return { isHeld, shown };
}

/**
 * Whether an id reference of `owner` reaches `element`: both have one root node. An owner with no
 * element reaches each element.
 */
export function isInTreeOf(owner: Element | null | undefined, element: Element): boolean {
  return !owner || owner.getRootNode() === element.getRootNode();
}
