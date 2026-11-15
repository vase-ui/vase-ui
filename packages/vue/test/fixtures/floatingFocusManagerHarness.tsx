import { cloneVNode, defineComponent, shallowRef } from 'vue';
import { useFloatingFocusManager } from '../../src/utils/popups/focus/FloatingFocusManager';
import type { FloatingFocusManagerProps } from '../../src/utils/popups/focus/FloatingFocusManager';

// The props have the array form, so Vue applies no default and no Boolean cast. The composable then
// applies the defaults, as for a popup part.
const propNames: (keyof FloatingFocusManagerProps)[] = [
  'store',
  'openInteractionType',
  'disabled',
  'initialFocus',
  'returnFocus',
  'explicitReturnFocus',
  'restoreFocus',
  'modal',
  'outsideElementsInert',
  'closeOnFocusOut',
  'nextFocusableElement',
  'previousFocusableElement',
  'beforeContentFocusGuardRef',
  'afterContentFocusGuardRef',
  'externalTree',
  'getInsideElements',
  'nodesAfterElement',
];

/**
 * The component form of `useFloatingFocusManager`, for the ported cases that Base UI writes with
 * `<FloatingFocusManager>`. The first element of its default slot is the element of the composable.
 */
export const FloatingFocusManager = defineComponent(
  (props: FloatingFocusManagerProps, { slots }) => {
    const element = shallowRef<HTMLElement | null>(null);
    useFloatingFocusManager(() => props, element);

    function setElement(value: unknown) {
      element.value = value as HTMLElement | null;
    }

    return () => {
      const [content, ...rest] = slots.default?.() ?? [];
      if (!content) {
        return null;
      }
      const elementNode = cloneVNode(content, { ref: setElement }, true);
      return rest.length > 0 ? [elementNode, ...rest] : elementNode;
    };
  },
  {
    name: 'FloatingFocusManager',
    props: propNames,
  },
);
