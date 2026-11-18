import { shallowRef } from 'vue';
import type { PopupInteractionStore } from '../types';
import { navigateUniformGrid } from '../../../internals/composite/gridNavigation';
import { useListNavigation } from './useListNavigation';

function useTypeTests(store: PopupInteractionStore) {
  const listRef = shallowRef<(HTMLElement | null)[]>([]);

  useListNavigation(store, { listRef, activeIndex: null, grid: () => navigateUniformGrid });
  useListNavigation(store, { listRef, activeIndex: null, grid: shallowRef(navigateUniformGrid) });

  // @ts-expect-error `toValue` calls a function, so the navigator comes from a ref or a getter.
  useListNavigation(store, { listRef, activeIndex: null, grid: navigateUniformGrid });
}

void useTypeTests;
