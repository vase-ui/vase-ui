import { defineComponent, KeepAlive, shallowRef } from 'vue';
import type { VNodeChild } from 'vue';
import { flushMicrotasks } from './flushMicrotasks';

/**
 * Makes `HeldBranch`, a branch in `KeepAlive`. `mountWhileHeld` mounts a part in that branch while
 * `KeepAlive` holds it. `KeepAlive` mounts such a part in an element that is not in the document. The part gets no
 * `onDeactivated` call, and its first `onActivated` call comes at the next show. A part that mounts
 * in the flush in which `KeepAlive` hides its branch gets `onDeactivated` in that flush, so
 * `mountWhileHeld` hides the branch in one flush and mounts the part in a later flush.
 */
export function createHeldBranch(renderPart: () => VNodeChild) {
  const visible = shallowRef(true);
  const mounted = shallowRef(false);
  const Branch = defineComponent(() => () => <div>{mounted.value ? renderPart() : null}</div>);
  const HeldBranch = defineComponent(() => () => (
    <KeepAlive>{visible.value ? <Branch /> : null}</KeepAlive>
  ));

  async function mountWhileHeld() {
    visible.value = false;
    await flushMicrotasks();
    mounted.value = true;
    await flushMicrotasks();
  }

  async function show() {
    visible.value = true;
    await flushMicrotasks();
  }

  async function hide() {
    visible.value = false;
    await flushMicrotasks();
  }

  // Vue clears `isDeactivated` of the branch after the renders of the flush of the activation. A
  // part that mounts in that flush thus starts held, and it gets `onActivated` in the same flush.
  async function mountInActivation() {
    visible.value = true;
    mounted.value = true;
    await flushMicrotasks();
  }

  return { HeldBranch, mountWhileHeld, show, hide, mountInActivation };
}
