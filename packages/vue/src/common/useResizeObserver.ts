import { toValue } from 'vue';
import type { MaybeRefOrGetter } from 'vue';
import { useObserver, type ObserverTargets } from './useObserver';

export function useResizeObserver(
  targets: ObserverTargets<Element>,
  onResize: (
    entries: ResizeObserverEntry[],
    observer: ResizeObserver,
    firstDelivery: boolean,
  ) => void,
  options?: MaybeRefOrGetter<ResizeObserverOptions | undefined>,
): void {
  useObserver(
    targets,
    () => ({ ...toValue(options) }),
    (view, isCurrent) => {
      if (!view.ResizeObserver) return undefined;
      let first = true;
      return new view.ResizeObserver((entries, observer) => {
        if (!isCurrent()) return;
        const firstDelivery = first;
        first = false;
        onResize(entries, observer, firstDelivery);
      });
    },
  );
}
