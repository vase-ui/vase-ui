import {
  getComputedStyle,
  getParentNode,
  isElement,
  isHTMLElement,
  isLastTraversableNode,
} from '@floating-ui/utils/dom';

export type ScrollAxis = 'horizontal' | 'vertical';

export function isScrollableY(element: HTMLElement, allowOverflowIntent = false): boolean {
  const { overflowY } = getComputedStyle(element);
  if (overflowY !== 'auto' && overflowY !== 'scroll') {
    return false;
  }
  // With `allowOverflowIntent`, a container that has a size on the axis counts, also when it
  // overflows only after space is added. An example is the scroll space that a drawer adds for
  // the virtual keyboard.
  return allowOverflowIntent
    ? element.clientHeight > 0
    : element.scrollHeight > element.clientHeight;
}

export function isScrollableX(element: HTMLElement, allowOverflowIntent = false): boolean {
  const { overflowX } = getComputedStyle(element);
  if (overflowX !== 'auto' && overflowX !== 'scroll') {
    return false;
  }
  return allowOverflowIntent ? element.clientWidth > 0 : element.scrollWidth > element.clientWidth;
}

export function isScrollable(
  element: HTMLElement,
  axis: ScrollAxis,
  allowOverflowIntent = false,
): boolean {
  return axis === 'vertical'
    ? isScrollableY(element, allowOverflowIntent)
    : isScrollableX(element, allowOverflowIntent);
}

export function findScrollableAncestor(
  target: EventTarget | null,
  root: HTMLElement,
  axis: ScrollAxis,
  allowOverflowIntent = false,
): HTMLElement | null {
  // `getParentNode` crosses shadow roots and slots. A target in a shadow root thus walks up to
  // the scrollable ancestors in the light DOM. A target that is not HTML (SVG, MathML) cannot
  // scroll, but its HTML ancestors can.
  let node: EventTarget | null = target;
  while (isElement(node) && node !== root && !isLastTraversableNode(node)) {
    if (isHTMLElement(node) && isScrollable(node, axis, allowOverflowIntent)) {
      return node;
    }
    node = getParentNode(node);
  }
  return null;
}

export function findScrollableTouchTarget(
  target: EventTarget | null,
  root: HTMLElement,
  axis: ScrollAxis = 'vertical',
  allowOverflowIntent = false,
): HTMLElement | null {
  return (
    findScrollableAncestor(target, root, axis, allowOverflowIntent) ??
    (isScrollable(root, axis, allowOverflowIntent) ? root : null)
  );
}
