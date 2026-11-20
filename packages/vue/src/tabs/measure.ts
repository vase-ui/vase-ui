import { getParentNode, isHTMLElement, isLastTraversableNode } from '@floating-ui/utils/dom';
import { ownerWindow } from '../common/owner';
import { getCssDimensions } from './getCssDimensions';
import { getElementTransform } from '../common/getElementTransform';
import type { TabsTabPosition, TabsTabSize } from './types';

export interface ActiveTabMeasure {
  position: TabsTabPosition;
  size: TabsTabSize;
}

// `offsetLeft` and `offsetTop` are whole pixels. The error adds up along the chain of offset
// parents.
const MAX_LAYOUT_ROUNDING_ERROR = 2;

/** The place and the size of the active tab in the layout of its list. */
export function measureActiveTab(tab: HTMLElement, list: HTMLElement): ActiveTabMeasure {
  const { width, height } = getCssDimensions(tab);
  const { width: listWidth, height: listHeight } = getCssDimensions(list);
  const tabRect = tab.getBoundingClientRect();
  const listRect = list.getBoundingClientRect();
  const scaleX = listRect.width / listWidth;
  const scaleY = listRect.height / listHeight;

  // The layout offset ignores transforms, but it has no sub-pixel precision.
  let { left, top } = getLayoutOffset(tab, list);

  const rectLeft = (tabRect.left - listRect.left) / scaleX + list.scrollLeft - list.clientLeft;
  const rectTop = (tabRect.top - listRect.top) / scaleY + list.scrollTop - list.clientTop;

  // The offset from the rect has sub-pixel precision, but it comes from the place in the viewport.
  // A rotation, a skew, a flip, a perspective or a 3D transform on the tab or on an ancestor
  // distorts it, and the division by the scale cannot undo that. When the two offsets agree up to
  // the layout rounding, no distortion is in effect, and the offset from the rect is safe to use.
  // A list that is scaled to zero, or that has no size, gives `NaN` or `Infinity` above. That fails
  // the same check, so the layout offset stays and the scale needs no guard.
  // The translation of the tab itself moves the rect and not the layout offset, so the check removes
  // it. The indicator is a sibling of the tab and does not get its transform. It then follows a tab
  // that moves itself, such as `translateX(12px)` on the active tab.
  const translation = getTranslation(tab);
  if (
    Math.abs(rectLeft - translation.x - left) <= MAX_LAYOUT_ROUNDING_ERROR &&
    Math.abs(rectTop - translation.y - top) <= MAX_LAYOUT_ROUNDING_ERROR
  ) {
    left = rectLeft;
    top = rectTop;
  }

  return {
    position: {
      left,
      right: list.scrollWidth - left - width,
      top,
      bottom: list.scrollHeight - top - height,
    },
    size: { width, height },
  };
}

function getLayoutOffset(element: HTMLElement, ancestor: HTMLElement) {
  const elementOffset = getCumulativeOffset(element);
  const ancestorOffset = getCumulativeOffset(ancestor);

  let left = elementOffset.left - ancestorOffset.left - ancestor.clientLeft;
  let top = elementOffset.top - ancestorOffset.top - ancestor.clientTop;

  // A scroll does not change the layout. A scroll container between the tab and the list moves the
  // tab on the screen, but not its layout slot. The loop removes that scroll, so that this offset
  // stays comparable with the offset from the rect. The scroll of the list stays, because the
  // indicator scrolls with the tab inside it. `getParentNode` also crosses the boundary of a shadow
  // root.
  let node: Node | null = getParentNode(element);
  while (isHTMLElement(node) && node !== ancestor && !isLastTraversableNode(node)) {
    left -= node.scrollLeft;
    top -= node.scrollTop;
    node = getParentNode(node);
  }

  return { left, top };
}

function getCumulativeOffset(element: HTMLElement) {
  let left = 0;
  let top = 0;
  let current: HTMLElement | null = element;

  while (current != null) {
    left += current.offsetLeft;
    top += current.offsetTop;

    const offsetParent = current.offsetParent as HTMLElement | null;
    if (offsetParent != null) {
      left += offsetParent.clientLeft;
      top += offsetParent.clientTop;
    }

    current = offsetParent;
  }

  return { left, top };
}

// The 2D translation of the tab in CSS pixels: the translation of the matrix of the computed
// `transform`, and the `translate` longhand. CSS applies `translate`, `rotate`, `scale` and
// `transform` in that order, so the sum is exact only with no rotation and no scale. That is enough
// here: with a rotation or a scale, the caller refuses the offset from the rect.
function getTranslation(element: HTMLElement) {
  const computedStyle = ownerWindow(element).getComputedStyle(element);
  const { x, y } = getElementTransform(element, computedStyle);
  let translateX = x;
  let translateY = y;

  // The computed `transform` does not include the `translate` longhand. A computed value keeps a
  // percentage, which resolves against the border box of the tab.
  const { translate } = computedStyle;
  if (translate !== 'none') {
    const parts = translate.split(' ');
    translateX += resolveTranslateLength(parts[0], element.offsetWidth);
    translateY += resolveTranslateLength(parts[1], element.offsetHeight);
  }

  return { x: translateX, y: translateY };
}

// A value that is not a number or a percentage, such as `calc(...)`, gives `NaN`. The caller then
// refuses the offset from the rect, and the indicator keeps the layout offset and does not guess.
function resolveTranslateLength(value = '0', referenceSize: number): number {
  const numeric = Number.parseFloat(value);
  return value.endsWith('%') ? (numeric / 100) * referenceSize : numeric;
}
