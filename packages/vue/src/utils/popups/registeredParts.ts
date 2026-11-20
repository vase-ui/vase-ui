export const clickTriggers = new WeakMap<Element, () => boolean>();
export const menuPopups = new WeakMap<Element, () => string | undefined>();
export const submenuTriggers = new WeakMap<Element, () => boolean>();

export const positionerHandlers = new WeakMap<Element, () => Set<Record<string, unknown>>>();

export function bindPositionerHandlers(element: Element, props: Record<string, unknown>) {
  const handlers = positionerHandlers.get(element)?.();
  if (handlers) {
    handlers.add(props);
    return () => handlers.delete(props);
  }
  return undefined;
}
