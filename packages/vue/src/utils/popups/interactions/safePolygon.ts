import type { Side } from '@floating-ui/vue';

const POLYGON_BUFFER = 0.5;

function hasIntersectingEdge(
  pointX: number,
  pointY: number,
  xi: number,
  yi: number,
  xj: number,
  yj: number,
) {
  return yi >= pointY !== yj >= pointY && pointX <= ((xj - xi) * (pointY - yi)) / (yj - yi) + xi;
}

function isPointInQuadrilateral(
  pointX: number,
  pointY: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  x3: number,
  y3: number,
  x4: number,
  y4: number,
) {
  let isInsideValue = false;

  if (hasIntersectingEdge(pointX, pointY, x1, y1, x2, y2)) {
    isInsideValue = !isInsideValue;
  }

  if (hasIntersectingEdge(pointX, pointY, x2, y2, x3, y3)) {
    isInsideValue = !isInsideValue;
  }

  if (hasIntersectingEdge(pointX, pointY, x3, y3, x4, y4)) {
    isInsideValue = !isInsideValue;
  }

  if (hasIntersectingEdge(pointX, pointY, x4, y4, x1, y1)) {
    isInsideValue = !isInsideValue;
  }

  return isInsideValue;
}

/**
 * The bridge covers the gap between the nearest edges. The polygon also permits diagonal travel.
 * @see https://floating-ui.com/docs/useHover#safepolygon
 */
export function safePolygon(
  side: Side,
  x: number,
  y: number,
  clientX: number,
  clientY: number,
  reference: DOMRect,
  popup: DOMRect,
): 'bridge' | 'polygon' | 'outside' {
  const vertical = side === 'top' || side === 'bottom';
  const forward = side === 'bottom' || side === 'right';
  const main = vertical ? y : x;
  const cross = vertical ? x : y;
  const start = vertical ? 'top' : 'left';
  const end = vertical ? 'bottom' : 'right';
  const crossStart = vertical ? 'left' : 'top';
  const crossEnd = vertical ? 'right' : 'bottom';

  if (forward ? main <= reference[start] + 1 : main >= reference[end] - 1) {
    return 'outside';
  }

  const span = vertical ? 'width' : 'height';
  const wider = popup[span] > reference[span];
  const narrow = wider ? reference : popup;
  const near = forward ? popup[start] : popup[end];
  const far = forward ? popup[end] : popup[start];
  const a = forward ? near + 1 : near - 1;
  const b = forward ? reference[end] - 1 : reference[start] + 1;
  const pointerMain = vertical ? clientY : clientX;
  const pointerCross = vertical ? clientX : clientY;
  if (
    pointerMain >= Math.min(a, b) &&
    pointerMain <= Math.max(a, b) &&
    pointerCross >= narrow[crossStart] &&
    pointerCross <= narrow[crossEnd]
  ) {
    return 'bridge';
  }

  const pastCenter = cross > popup[crossEnd] - popup[span] / 2;
  const offset = wider ? POLYGON_BUFFER / 2 : POLYGON_BUFFER * 4;
  const fromA = wider || pastCenter ? cross + offset : cross - offset;
  const fromB = !wider && pastCenter ? cross + offset : cross - offset;
  const fromMain = forward ? main - POLYGON_BUFFER : main + POLYGON_BUFFER + 1;
  const edge = forward ? near + POLYGON_BUFFER : near - POLYGON_BUFFER;
  const toA = wider || pastCenter ? edge : far;
  const toB = wider || !pastCenter ? edge : far;
  const inside = vertical
    ? isPointInQuadrilateral(
        clientX,
        clientY,
        fromA,
        fromMain,
        fromB,
        fromMain,
        popup.left,
        toA,
        popup.right,
        toB,
      )
    : isPointInQuadrilateral(
        clientX,
        clientY,
        fromMain,
        fromA,
        fromMain,
        fromB,
        toA,
        popup.top,
        toB,
        popup.bottom,
      );
  return inside ? 'polygon' : 'outside';
}
