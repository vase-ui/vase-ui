import { shallowRef } from 'vue';
import type { PopupInteractionStore } from '../types';
import { gridNavigation } from './gridNavigation';
import { useListNavigation } from './useListNavigation';

function useTypeTests(store: PopupInteractionStore) {
  const listRef = shallowRef<Array<HTMLElement | null>>([]);

  useListNavigation(store, { listRef, activeIndex: null, grid: () => gridNavigation });
  useListNavigation(store, { listRef, activeIndex: null, grid: shallowRef(gridNavigation) });

  // @ts-expect-error `toValue` calls a function, so the navigator comes from a ref or a getter.
  useListNavigation(store, { listRef, activeIndex: null, grid: gridNavigation });
}

void useTypeTests;
