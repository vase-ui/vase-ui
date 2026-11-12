import { computed, inject } from 'vue';
import type { ComputedRef, InjectionKey } from 'vue';

export type TextDirection = 'ltr' | 'rtl';

export type DirectionContext = {
  direction: TextDirection;
};

export const DirectionContext: InjectionKey<ComputedRef<DirectionContext>> = Symbol();

/**
 * Gives the text direction of the nearest `DirectionProvider`, or `'ltr'` when there is none.
 * Call it in `setup`.
 * The result is a ref, because `setup` runs one time and the provider can change.
 */
export function useDirection(): ComputedRef<TextDirection> {
  // With one argument, Vue shows a warning when there is no provider. That case is normal here.
  const context = inject(DirectionContext, undefined);

  return computed(() => context?.value.direction ?? 'ltr');
}
