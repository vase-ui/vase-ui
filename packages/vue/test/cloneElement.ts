import { h } from 'vue';
import type { VNode } from 'vue';

type Slot = (...args: any[]) => unknown;

/**
 * Makes a new vnode of the same type, with new props and slots. A new prop replaces the old prop of
 * the same key. It does not merge. Call it in a render function when a prop is `ref`.
 */
export function cloneElement(
  element: VNode,
  props?: Record<string, unknown>,
  slots?: Record<string, Slot>,
): VNode {
  const { children } = element;
  const hasSlots = typeof children === 'object' && children !== null && !Array.isArray(children);
  const newChildren = slots && hasSlots ? { ...children, ...slots } : (slots ?? children);
  return h(element.type as any, { ...element.props, ...props }, newChildren as any);
}
