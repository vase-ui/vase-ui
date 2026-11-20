import { h, mergeProps } from 'vue';
import type { Component, FunctionalComponent } from 'vue';

/**
 * Returns `part` with `props` set. An attribute of the caller wins over a prop of the same name.
 * The class of the caller follows the class of `props`, and the styles merge. The slots go to the
 * part as they are. A template ref on the wrapper gives the root element of the part, not its
 * exposed values.
 *
 * The vnode that `h()` makes is outside a block of Vue. The part and each component in its slots
 * thus render again each time the wrapper renders. Vue patches the same nodes and mounts none
 * again.
 *
 * The compiler of Vue avoids these renders with `openBlock`, `createBlock` and patch flags. Do not
 * copy that form: a wrong flag drops a slot.
 */
export function withProps<Part>(part: Part, props: Record<string, unknown>): Part {
  const Wrapper: FunctionalComponent = (_, { attrs, slots }) =>
    h(part as Component, mergeProps(props, attrs), slots);
  Wrapper.inheritAttrs = false;
  return Wrapper as Part;
}
