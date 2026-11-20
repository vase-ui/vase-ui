import { computed, inject } from 'vue';
import type { ComputedRef, InjectionKey } from 'vue';

export type TextDirection = 'ltr' | 'rtl';

export const DirectionContext: InjectionKey<ComputedRef<TextDirection>> = Symbol();

/**
 * Gives the text direction of the nearest provider of `DirectionContext`, or `'ltr'` when there is none.
 * Call it in `setup`.
 * The result is a ref, because `setup` runs one time and the provider can change.
 */
export function useDirection(): ComputedRef<TextDirection> {
  return inject(DirectionContext, () => computed<TextDirection>(() => 'ltr'), true);
}
