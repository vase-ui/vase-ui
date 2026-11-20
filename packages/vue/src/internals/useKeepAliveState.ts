import { onActivated, onDeactivated, onMounted, shallowRef } from 'vue';
// eslint-disable-next-line no-restricted-imports -- Vue has no other API that tells a part that it mounts in a branch that `KeepAlive` holds. Vue exports `getCurrentInstance` and types its `parent` and `isDeactivated` fields. A part compiled as a Vapor component gets `false`.
import { getCurrentInstance } from 'vue';
import type { Ref } from 'vue';

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
function isInHeldBranch(): boolean {
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
   * Whether `KeepAlive` holds the part. A compiled Vapor part on Vue 3.6.0-rc.16 cannot detect
   * an existing hold at mount.
   */
  isHeld: Readonly<Ref<boolean>>;
  /**
   * Counts the activations by `KeepAlive`. The `onActivated` call of the mount does not count when
   * the part mounts with its branch. It counts when the part mounts in the flush in which
   * `KeepAlive` shows the branch.
   */
  shown: Readonly<Ref<number>>;
}

/**
 * Follows whether `KeepAlive` holds a part and counts its activations. Call it in `setup`.
 *
 * React to a change of `isHeld` with a `watch`. With `flush: 'sync'`, the callback runs in the
 * `onDeactivated` or `onActivated` hook that changes `isHeld`.
 *
 * An app that mounts in a detached element is not held, because no `KeepAlive` holds it.
 */
export function useKeepAliveState(): KeepAliveState {
  const mountsInHeldBranch = isInHeldBranch();
  const isHeld = shallowRef(mountsInHeldBranch);
  const shown = shallowRef(0);
  let isMountFlush = false;

  onMounted(() => {
    isMountFlush = true;
    // The promise of `nextTick` rejects when a render of the flush throws. Its callback then does
    // not run, the flag stays set, and the rejection is not handled.
    queueMicrotask(() => {
      isMountFlush = false;
    });
  });

  onDeactivated(() => {
    // A hold and a show can both come in the flush of the mount. That show is not the call of the
    // mount.
    isMountFlush = false;
    isHeld.value = true;
  });

  // `onActivated` also runs in the flush of the first mount in a `KeepAlive`. A part that mounted
  // in a held branch gets the next call with no `onDeactivated` before it. That call comes in the
  // flush of the mount when `KeepAlive` shows the branch in that flush. It comes before `onMounted`
  // when a component of the branch mounts the part from its own state. It comes after `onMounted`
  // when the root of the branch gets the part from a prop. `isInHeldBranch()` in `setup` gives
  // `true` in both orders.
  onActivated(() => {
    if (isMountFlush && !mountsInHeldBranch) {
      return;
    }
    isHeld.value = false;
    shown.value += 1;
  });

  return { isHeld, shown };
}
