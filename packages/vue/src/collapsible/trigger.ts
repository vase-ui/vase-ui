import { useSlots, type Ref } from 'vue';
import { useButton } from '../common/button';
import type { CollapsiblePart } from './part';

/** The behavior of `Collapsible.Trigger` and `Accordion.Trigger`. */
export function useCollapsibleTrigger(
  part: CollapsiblePart,
  options: {
    element: Readonly<Ref<Element | null>>;
    /** Disabled by the trigger itself. */
    disabled: () => boolean;
    as: () => unknown;
  },
) {
  const slots = useSlots();
  const button = useButton({
    element: options.element,
    disabled: () => options.disabled() || part.disabled,
    // A tag in `as` is known at the render. The element of a component or of the `element` slot,
    // which wins over `as`, is known after the mount.
    tag: () => {
      const as = options.as();
      return typeof as === 'string' && !slots.element ? as : undefined;
    },
    type: 'button',
  });

  function onClick(event: MouseEvent) {
    part.request(!part.open, 'trigger-press', event);
  }

  return {
    /** By the trigger, by its root or item, or by a disabled fieldset around a native button. */
    disabled: button.disabled,
    elementProps(own: Record<string, unknown>, attrs: Record<string, unknown>) {
      return button.mergeAttributes(
        {
          'aria-expanded': part.open ? 'true' : 'false',
          'aria-controls': part.open ? part.panelId : undefined,
          onClick,
          ...own,
        },
        attrs,
      );
    },
  };
}
