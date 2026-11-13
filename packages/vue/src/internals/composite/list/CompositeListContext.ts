import { inject } from 'vue';
import type { ComputedRef, InjectionKey, MaybeRefOrGetter } from 'vue';
import type { CompositeMetadata } from './useCompositeList';

export interface CompositeListRegistration<Metadata> {
  metadata: MaybeRefOrGetter<Metadata | undefined>;
  index: MaybeRefOrGetter<number | undefined>;
  label: MaybeRefOrGetter<string | null | undefined>;
  textRef: MaybeRefOrGetter<HTMLElement | null | undefined>;
}

export interface CompositeListContextValue<Metadata> {
  register: (node: Element, registration: CompositeListRegistration<Metadata>) => void;
  unregister: (node: Element) => void;
  scheduleMapUpdate: () => void;
  takeIndexGuess: () => number;
  map: ComputedRef<ReadonlyMap<Element, CompositeMetadata<Metadata>>>;
}

export const CompositeListContext: InjectionKey<CompositeListContextValue<any>> = Symbol();

export function useCompositeListContext(): CompositeListContextValue<any> | undefined {
  // The default `undefined` stops the Vue warning for a missing provider.
  // An item with no list is valid, so this function does not throw.
  return inject(CompositeListContext, undefined);
}
