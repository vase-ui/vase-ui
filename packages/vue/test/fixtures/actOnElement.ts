import { h } from 'vue';
import type { Component } from 'vue';

export interface RenderArguments {
  props: Record<string, any>;
  children?: Component;
}

/**
 * Gives a part a `#render` slot whose element gets the `ref` of the part and then `act`, one time.
 * A `ref` on a part gives the component, so a case that acts on the element uses this slot.
 * `children` renders the content of the element.
 */
export function actOnElement(
  tag: string,
  act: (element: HTMLElement) => void,
  children?: (args: RenderArguments) => unknown,
) {
  let acted = false;
  return {
    render: (args: RenderArguments) =>
      h(
        tag,
        {
          ...args.props,
          ref: (element: unknown) => {
            args.props.ref(element);
            if (element && !acted) {
              acted = true;
              act(element as HTMLElement);
            }
          },
        },
        children?.(args) as any,
      ),
  };
}
