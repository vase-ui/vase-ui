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
  const mountedByProp = shallowRef(false);
  const Branch = defineComponent(
    (props: { mounted: boolean }) => () =>
      renderBranch(props.mounted || mounted.value ? renderPart() : null),
    { props: ['mounted'] },
  );
  const HeldBranch = defineComponent(() => () => (
    <KeepAlive>{visible.value ? <Branch mounted={mountedByProp.value} /> : null}</KeepAlive>
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

  // `KeepAlive` moves the branch into the document before the part mounts. The part thus mounts in
  // the document, and it gets its first `onActivated` call in the flush of its mount. With
  // `fromProp`, the branch gets the mount as a prop. `KeepAlive` then mounts the part when it
  // patches the branch, before it queues the hooks of the show, so the part gets `onMounted` first.
  // Else the branch mounts the part in its own render. That render comes after `KeepAlive` queues
  // the hooks of the show, so the part gets `onActivated` first.
  async function mountInActivation({ fromProp = false }: { fromProp?: boolean | undefined } = {}) {
    visible.value = true;
    (fromProp ? mountedByProp : mounted).value = true;
    await flushMicrotasks();
  }

  return { HeldBranch, hide, mountWhileHeld, show, mountInActivation };
}
