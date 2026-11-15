/**
 * A box on the axis of the root, in layout pixels from the padding edge of the root element.
 */
export interface AxisBox {
  start: number;
  end: number;
}

interface BoundaryPanel {
  /**
   * The position of the panel among the panels and the handles of the root.
   */
  index: number;
  disabled: boolean;
}

/**
 * The boundaries of two panels that follow each other and have no handle between them. A disabled
 * handle between the panels removes the boundary: its place is taken. A boundary has no edge when
 * the root is disabled, or when each panel on one side of it is disabled, because a drag at the
 * boundary then moves nothing.
 * @param panels The panels in the order of the document.
 * @param handleIndexes The index of each handle, also of a disabled one.
 */
export function getBoundaries<Panel extends BoundaryPanel>(
  panels: readonly Panel[],
  handleIndexes: readonly number[],
  rootDisabled: boolean,
): { before: Panel; after: Panel }[] {
  if (rootDisabled) {
    return [];
  }
  const boundaries: { before: Panel; after: Panel }[] = [];
  for (const [position, before] of panels.entries()) {
    const after = panels[position + 1];
    if (
      after !== undefined &&
      !handleIndexes.some((index) => index > before.index && index < after.index) &&
      !panels.slice(0, position + 1).every((panel) => panel.disabled) &&
      !panels.slice(position + 1).every((panel) => panel.disabled)
    ) {
      boundaries.push({ before, after });
    }
  }
  return boundaries;
}

/**
 * The areas of an edge: a boundary of two panels that have no handle between them. `adjacent`: the
 * two panel elements are siblings with no element between them. Then, or when the gap is not wider
 * than `size`, one area covers the gap and is `size` wide or more. Else an element can be in the
 * gap, and each panel edge gets an area of its own, so the element keeps its presses. An area with
 * no width is not in the result.
 */
export function getEdgeAreas(
  boxBefore: AxisBox,
  boxAfter: AxisBox,
  size: number,
  adjacent: boolean,
): AxisBox[] {
  // The panel before the boundary is on the right in a horizontal root with the direction `rtl`.
  const [first, second] =
    boxBefore.start <= boxAfter.start ? [boxBefore, boxAfter] : [boxAfter, boxBefore];
  const gap = Math.max(second.start - first.end, 0);
  const areas =
    adjacent || gap <= size
      ? [around((first.end + second.start) / 2, Math.max(gap, size))]
      : [around(first.end, size), around(second.start, size)];
  return areas.filter((area) => area.end > area.start);
}

function around(center: number, width: number): AxisBox {
  return { start: center - width / 2, end: center + width / 2 };
}
