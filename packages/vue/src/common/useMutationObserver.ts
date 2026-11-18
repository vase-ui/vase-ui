import { toValue } from 'vue';
import type { MaybeRefOrGetter } from 'vue';
import { useObserver, type ObserverTargets } from './useObserver';

export function useMutationObserver(
  targets: ObserverTargets<Node>,
  options: MaybeRefOrGetter<MutationObserverInit>,
  onMutation: MutationCallback,
): void {
  const readOptions = () => {
    const init = toValue(options);
    const snapshot: MutationObserverInit = {};
    for (const key of [
      'attributes',
      'attributeOldValue',
      'characterData',
      'characterDataOldValue',
      'childList',
      'subtree',
    ] as const) {
      const value = init[key];
      if (value !== undefined) snapshot[key] = value;
    }
    const filter = init.attributeFilter;
    if (filter) snapshot.attributeFilter = [...filter];
    return snapshot;
  };
  useObserver(targets, readOptions, (view, isCurrent) => {
    if (!view.MutationObserver) return undefined;
    return new view.MutationObserver((records, observer) => {
      if (isCurrent()) onMutation(records, observer);
    });
  });
}
