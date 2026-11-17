import { computed, toValue } from 'vue';
import type { ComputedRef, MaybeRefOrGetter } from 'vue';
import { useIsHydrating } from '../../common/hydration';
import type { PopupHandleStoreProvider } from './popupHandle';

/**
 * Reads the store that a popup handle gives now. A detached trigger uses it to follow a handle as a
 * root attaches and detaches. While no root is attached, the result is the inert store of the
 * handle. Once a root attaches, the result is the store of that root.
 *
 * The trigger uses the inert store on the server and while it hydrates. A root can attach before
 * a trigger in an async `<Suspense>` branch hydrates. With the root store, its first render could
 * differ from the server HTML. `useRenderElement` can correct only `role`, `abbr`, `data-*` and
 * `aria-*` except `aria-hidden`. Vue warns if `disabled` differs and keeps its server value. The
 * same applies to a class or style that a consumer derives from the state. Slot content from that
 * state can also cause a hydration warning.
 *
 * The result is `undefined` when the trigger has no handle, so that the caller can use the store of
 * its root.
 *
 * Call it in `setup`.
 *
 * @param handle The popup handle to read, or `undefined` when the trigger has no handle.
 */
export function usePopupHandleStore<HandleStore>(
  handle: MaybeRefOrGetter<PopupHandleStoreProvider<HandleStore> | undefined>,
): ComputedRef<HandleStore | undefined> {
  const isHydrating = useIsHydrating();

  return computed(() => {
    const current = toValue(handle);
    if (current === undefined) {
      return undefined;
    }
    return isHydrating.value ? current.serverStore : current.store;
  });
}
