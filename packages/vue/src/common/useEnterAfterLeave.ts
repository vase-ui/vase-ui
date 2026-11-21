import { shallowRef, watch, type Ref } from 'vue';

// Remove this file when the Vue 3.6 of the tests has the fix of
// https://github.com/vuejs/core/issues/16359 (3.6.0-rc.16). Vue 3.5.46 has it.
/**
 * Holds back the new element of a part while its old element leaves in a `<Transition>`. Vue
 * 3.6.0-rc.15 gives a new element that enters during that leave no enter
 * (test/measurements/collapsible.test.ts), so the part renders its element only while `waiting` is
 * `false`.
 */
export function useEnterAfterLeave(shown: () => boolean, element: Readonly<Ref<Element | null>>) {
  const waiting = shallowRef(false);
  // A weak reference lets the browser free the removed element.
  let leaving: WeakRef<Element> | undefined;
  watch(shown, (isShown) => {
    if (!isShown) {
      const current = element.value;
      leaving = current ? new WeakRef(current) : undefined;
      return;
    }
    const gone = leaving?.deref();
    const parent = gone?.parentNode;
    // A kept element stays in the DOM, so it does not leave.
    if (!gone || !parent || gone === element.value) return;
    waiting.value = true;
    const observer = new MutationObserver(() => {
      if (gone.isConnected) return;
      observer.disconnect();
      waiting.value = false;
    });
    observer.observe(parent, { childList: true });
  });
  return { waiting };
}
