import { defineComponent, KeepAlive, shallowRef } from 'vue';
import type { VNodeChild } from 'vue';
import { flushMicrotasks } from './flushMicrotasks';

/**
 * Renders a branch in `KeepAlive`, and mounts a part in that branch while `KeepAlive` holds it.
 * `KeepAlive` mounts such a part in an element that is not in the document. The part gets no
 * `onDeactivated` call, and its first `onActivated` call comes at the next show.
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

  return { HeldBranch, mountWhileHeld, show };
}
