import { h } from 'vue';
import type { Component } from 'vue';

export function throwMissingPropError(field: string): never {
  throw new Error(`missing "${field}" in options

  > describeConformance(element, () => options)
`);
}

/**
 * Gives an element of a `#render` slot the slots that mount the `children` component of the part.
 * In React the nodes of a part come through `props.children`. A part that has no nodes of its own
 * gives no `children`, and the element then has no slots.
 * A plain element reads its default slot only when the slot returns an array.
 */
export function childrenSlots(children: Component | undefined) {
  return children && { default: () => [h(children)] };
}
