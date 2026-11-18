import { computed, shallowReactive, toValue, watch } from 'vue';
import type { MaybeRefOrGetter } from 'vue';
import type { HoverIntent } from './hoverIntent';

type PointerEvents = 'auto' | 'none' | 'inherit';
const overrides = shallowReactive(new WeakMap<Element, Map<HoverIntent, PointerEvents>>());
const owners = new WeakMap<Element, number>();

export function hasHoverBinding(element: Element) {
  return owners.has(element);
}

export function setHoverPointerEvents(
  element: Element,
  intent: HoverIntent,
  value?: PointerEvents,
) {
  const requests = new Map(overrides.get(element));
  requests.delete(intent);
  if (value !== undefined) {
    requests.set(intent, value);
  }
  if (requests.size) {
    overrides.set(element, requests);
  } else {
    overrides.delete(element);
  }
}

export function hoverPointerStyle(element: Element | null | undefined) {
  const requests = element && overrides.get(element);
  if (!requests) {
    return undefined;
  }
  // A child popup can borrow a parent's positioner as its scope.
  return { pointerEvents: Array.from(requests.values()).at(-1) };
}

export function useHoverPointerStyle(source: MaybeRefOrGetter<Element | null | undefined>) {
  watch(
    () => toValue(source),
    (element, _, onCleanup) => {
      if (element) {
        owners.set(element, (owners.get(element) ?? 0) + 1);
        onCleanup(() => {
          const count = owners.get(element) ?? 0;
          if (count > 1) {
            owners.set(element, count - 1);
          } else {
            owners.delete(element);
          }
        });
      }
    },
    { immediate: true, flush: 'sync' },
  );
  return computed(() => hoverPointerStyle(toValue(source)));
}
