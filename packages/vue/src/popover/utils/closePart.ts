import { computed, inject, onScopeDispose, provide, shallowRef } from 'vue';
import type { ComputedRef, InjectionKey } from 'vue';

interface ClosePartContext {
  register: () => () => void;
}

const ClosePartContext: InjectionKey<ClosePartContext> = Symbol();

/**
 * Counts the close parts in the popup. Returns whether the popup has one.
 */
export function useClosePartCount(): ComputedRef<boolean> {
  const count = shallowRef(0);

  provide(ClosePartContext, {
    register() {
      count.value += 1;
      return () => {
        count.value -= 1;
      };
    },
  });

  return computed(() => count.value > 0);
}

/**
 * Adds the close part to the count of its popup while the part exists.
 */
export function useClosePartRegistration(): void {
  const context = inject(ClosePartContext, undefined);
  if (context !== undefined) {
    onScopeDispose(context.register());
  }
}
