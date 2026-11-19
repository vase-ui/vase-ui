import type { ResizableRootContext } from '../root/ResizableRootContext';
import { getHandleLimits } from './layout';

/**
 * The ends of the travel of the boundary after the panel `pivot`, as sides of the screen: `atMin`
 * is the left side, or the top side in a vertical root. The handle and the edges show them.
 */
export function getHandleEnds(root: ResizableRootContext, pivot: number) {
  // A root that waits for a length has no layout to move.
  if (pivot < 0 || root.lengthPanels.value.size > 0) {
    return { atMin: false, atMax: false };
  }
  return getHandleLimits(
    root.constraints.value,
    root.shown.value,
    pivot,
    root.pushPanels.value,
    root.orientation.value === 'horizontal' && root.direction.value === 'rtl',
  );
}
