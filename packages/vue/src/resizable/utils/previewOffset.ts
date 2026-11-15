import type { ResizableRootContext } from '../root/ResizableRootContext';

/**
 * The distance from the boundary after the panel `pivot` to the place that the release of the drag
 * gives it, in layout pixels with the unit, such as `12.5px`. A positive distance is to the right,
 * or down in a vertical root. The result is `undefined` while the root has no pending layout. The
 * boundary that the drag moves has the distance also when it is 0. Another boundary has it only
 * when it moves.
 */
export function getPreviewOffset(
  root: ResizableRootContext,
  pivot: number,
  dragging: boolean,
): string | undefined {
  const pending = root.pendingLayout.value;
  const measurement = root.measurement.value;
  if (pending === undefined || measurement === undefined || pivot < 0) {
    return undefined;
  }
  // The panels before the boundary grow by this sum, and the boundary moves by the same size.
  const shown = root.shown.value;
  let percent = 0;
  for (const panel of root.constraints.value.slice(0, pivot + 1)) {
    percent += (pending[panel.id] ?? 0) - (shown[panel.id] ?? 0);
  }
  const flipped = root.orientation.value === 'horizontal' && root.direction.value === 'rtl';
  const pixels =
    Math.round((((flipped ? -percent : percent) * measurement.space) / 100) * 1000) / 1000;
  return dragging || pixels !== 0 ? `${pixels}px` : undefined;
}
