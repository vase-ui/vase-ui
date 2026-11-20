import { computed, onMounted, shallowRef } from 'vue';
import type { ComputedRef, Ref } from 'vue';

// Vue has no public API that tells a hydration from a client-only mount in `setup`.
// The lifecycle gives two facts. A server render never calls `onMounted`.
// An app that hydrates calls it after the hydration of the component.
// https://vuejs.org/api/composition-api-lifecycle.html#onmounted
// https://vuejs.org/guide/scaling-up/ssr.html#hydration-mismatch
//
// Each call is for the component that calls it. A part that hydrates after its root, such as an
// async component in `<Suspense>`, then still reads its first render as hydrating.
// The cost: the first render of a client-only mount also reads as hydrating. The component then
// renders again in the flush after the mount, before a paint.

/** Gives `true` once the component that calls it is mounted on the client. */
export function useIsHydrated(): Readonly<Ref<boolean>> {
  const hydrated = shallowRef(false);
  onMounted(() => {
    hydrated.value = true;
  });
  return hydrated;
}

/**
 * Gives `true` on a server and until the component that calls it is mounted on the client.
 * It is the inverse of {@link useIsHydrated}.
 */
export function useIsHydrating(): ComputedRef<boolean> {
  const hydrated = useIsHydrated();
  return computed(() => !hydrated.value);
}
