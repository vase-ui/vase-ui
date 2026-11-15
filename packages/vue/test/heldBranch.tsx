import { defineComponent, KeepAlive, shallowRef } from 'vue';
import type { VNodeChild } from 'vue';
import { flushMicrotasks } from './flushMicrotasks';

interface HeldBranchOptions {
  /**
   * Renders the content of the branch. `part` is the vnode of `renderPart`, or `null` before the
   * mount. The default is a `div` that holds `part`.
   */
  renderBranch?: (part: VNodeChild) => VNodeChild;
  /** Whether the part mounts with the branch. The default is `false`. */
  mounted?: boolean;
}

/**
 * Makes `HeldBranch`, a branch in `KeepAlive`. `mountWhileHeld` mounts a part in that branch while
 * `KeepAlive` holds it. `KeepAlive` mounts such a part in an element that is not in the document.
 * The part gets no `onDeactivated` call, and its first `onActivated` call comes at the next show.
 */
export function createHeldBranch(renderPart: () => VNodeChild, options: HeldBranchOptions = {}) {
  const { renderBranch = (part) => <div>{part}</div>, mounted: isMountedWithBranch = false } =
    options;
  const visible = shallowRef(true);
  const mounted = shallowRef(isMountedWithBranch);
  const Branch = defineComponent(() => () => renderBranch(mounted.value ? renderPart() : null));
  const HeldBranch = defineComponent(() => () => (
    <KeepAlive>{visible.value ? <Branch /> : null}</KeepAlive>
  ));

  async function hide() {
    visible.value = false;
    await flushMicrotasks();
  }

  // A part that mounts in the flush in which `KeepAlive` hides its branch gets `onDeactivated` in
  // that flush. The mount thus comes in a later flush.
  async function mountWhileHeld() {
    await hide();
    mounted.value = true;
    await flushMicrotasks();
  }

  async function show() {
    visible.value = true;
    await flushMicrotasks();
  }

  // Vue clears `isDeactivated` of the branch after the renders of the flush of the activation. A
  // part that mounts in that flush thus starts held, and it gets `onActivated` in the same flush.
  async function mountInActivation() {
    visible.value = true;
    mounted.value = true;
    await flushMicrotasks();
  }

  return { HeldBranch, hide, mountWhileHeld, show, mountInActivation };
}
