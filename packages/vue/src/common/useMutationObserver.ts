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
    return { ...init, ...(init.attributeFilter && { attributeFilter: [...init.attributeFilter] }) };
  };
  useObserver(targets, readOptions, (view, isCurrent) => {
    if (!view.MutationObserver) return undefined;
    return new view.MutationObserver((records, observer) => {
      if (isCurrent()) onMutation(records, observer);
    });
  });
}
