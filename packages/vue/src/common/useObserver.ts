import { computed, onMounted, toValue, watch } from 'vue';
import type { MaybeRefOrGetter } from 'vue';
import { useKeepAliveState } from '../internals/useKeepAliveState';

export type ObserverTargets<T extends Node> = MaybeRefOrGetter<
  T | readonly (T | null | undefined)[] | null | undefined
>;

interface Observer<T extends Node, O> {
  observe(target: T, options: O): void;
  disconnect(): void;
}

function isDocument(node: Node): node is Document {
  return node.nodeType === node.DOCUMENT_NODE;
}

export function useObserver<T extends Node, O>(
  targets: ObserverTargets<T>,
  readOptions: () => O,
  create: (
    view: Window & typeof globalThis,
    isCurrent: () => boolean,
  ) => Observer<T, O> | undefined,
): void {
  const { isHeld, shown } = useKeepAliveState();
  const source = computed(() => {
    if (isHeld.value) return null;
    const nodes = toValue(targets);
    return {
      targets: new Set(nodes && 'nodeType' in nodes ? [nodes] : nodes),
      options: readOptions(),
      activation: shown.value,
    };
  });

  onMounted(() => {
    watch(
      source,
      (run, _, onCleanup) => {
        if (!run) return;
        const observers = new Map<Window, Observer<T, O> | undefined>();
        let active = true;
        onCleanup(() => {
          active = false;
          for (const observer of observers.values()) observer?.disconnect();
        });
        // A native delivery can precede the post-flush cleanup.
        const isCurrent = () => active && source.value === run;
        for (const node of run.targets) {
          if (!node) continue;
          const doc = isDocument(node) ? node : node.ownerDocument;
          const view = doc?.defaultView;
          if (!view) continue;
          if (!observers.has(view)) observers.set(view, create(view, isCurrent));
          observers.get(view)?.observe(node, run.options);
        }
      },
      { immediate: true, flush: 'post' },
    );
  });
}
