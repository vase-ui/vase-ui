import { clamp } from '../../common/clamp';

/**
 * The size of each panel in percent of the panel space, by panel id. The sizes of a layout sum to 100.
 */
export type Layout = Record<string, number>;

export interface PanelConstraints {
  id: string;
  /** In percent. */
  minSize: number;
  /** In percent. */
  maxSize: number;
  /** Whether the panel can collapse to `collapsedSize`. */
  collapsible: boolean;
  /** In percent. */
  collapsedSize: number;
  /** In percent. */
  defaultSize: number | undefined;
  /**
   * In percent. The distance that a drag must pass below `minSize` to collapse the panel, or above
   * `collapsedSize` to expand it. Without it, half of the distance between the two sizes.
   */
  collapseThreshold?: number | undefined;
  /** Whether a move of a handle leaves the size of the panel as it is. */
  locked?: boolean | undefined;
}

interface PanelSize {
  id: string;
  size: number;
}

export interface AdjustOptions {
  /**
   * A key or an action: a collapsible panel collapses or expands at once, with no threshold.
   */
  exact?: boolean | undefined;
  /**
   * Whether the move goes on into the panels after the panel beside the handle. With `false`, only
   * the two panels beside the handle change.
   */
  push?: boolean | undefined;
  /**
   * An action: the index of the one panel that the move can collapse, or -1 for none.
   * Without it, each collapsible panel can collapse.
   */
  only?: number | undefined;
}

const PRECISION = 1000;
const EPSILON = 1e-9;

function round(value: number): number {
  return Math.round(value * PRECISION) / PRECISION;
}

function sum(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function sizeOf(layout: Layout, panel: PanelConstraints): number {
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- A caller gives a layout that has an entry for each panel that it gives.
  return layout[panel.id]!;
}

function toLayout(entries: readonly PanelSize[], total = 100): Layout {
  const rounded = entries.map(({ id, size }) => ({ id, size: round(size) }));
  const largestSize = Math.max(...rounded.map((entry) => entry.size));
  const largest = rounded.find((entry) => entry.size === largestSize);
  // The rounding error goes to the largest panel, so the sum is exactly `total`.
  if (largest) {
    largest.size = round(largest.size + (total - sum(rounded.map((entry) => entry.size))));
  }
  return Object.fromEntries(rounded.map(({ id, size }) => [id, size]));
}

/**
 * Whether a panel of this size is collapsed: it is collapsible, and its size is its collapsed size.
 */
export function isCollapsed(panel: PanelConstraints, size: number): boolean {
  return panel.collapsible && size < panel.minSize && round(size) <= round(panel.collapsedSize);
}

/**
 * The size that the constraints of the panel allow for a wanted size.
 * A drag must pass the collapse threshold before a collapsible panel collapses or expands. With
 * `exact`, a key or an action collapses or expands it at once.
 */
export function resolveSize(
  panel: PanelConstraints,
  wanted: number,
  direction: 'grow' | 'shrink',
  exact = false,
): number {
  if (wanted >= panel.minSize || !panel.collapsible) {
    return clamp(wanted, panel.minSize, panel.maxSize);
  }
  const distance = panel.minSize - panel.collapsedSize;
  // A threshold that is greater than the distance acts as the distance.
  const threshold = exact ? 0 : Math.min(panel.collapseThreshold ?? distance / 2, distance);
  if (direction === 'grow') {
    return wanted > panel.collapsedSize + threshold ? panel.minSize : panel.collapsedSize;
  }
  return wanted <= panel.collapsedSize || wanted < panel.minSize - threshold
    ? panel.collapsedSize
    : panel.minSize;
}

/**
 * Puts each size inside its constraints, then gives the remainder to the panels that have room, in
 * their sequence. A collapsed panel takes none of it.
 */
export function validateLayout(panels: readonly PanelConstraints[], layout: Layout): Layout {
  const entries = panels.map((panel) => ({
    panel,
    size: resolveSize(panel, sizeOf(layout, panel), 'shrink'),
  }));
  let remainder = 100 - sum(entries.map((entry) => entry.size));
  for (const entry of entries) {
    if (Math.abs(remainder) <= EPSILON) {
      break;
    }
    const next = isCollapsed(entry.panel, entry.size)
      ? entry.size
      : clamp(entry.size + remainder, entry.panel.minSize, entry.panel.maxSize);
    remainder -= next - entry.size;
    entry.size = next;
  }
  return toLayout(entries.map(({ panel, size }) => ({ id: panel.id, size })));
}

/**
 * Whether a layout of the panels sums to 100 inside their constraints.
 */
export function areConstraintsFeasible(panels: readonly PanelConstraints[]): boolean {
  return (
    panels.length === 0 ||
    (panels.every((panel) => panel.minSize <= panel.maxSize + EPSILON) &&
      sum(panels.map((panel) => panel.minSize)) <= 100 + EPSILON &&
      sum(panels.map((panel) => panel.maxSize)) >= 100 - EPSILON)
  );
}

/**
 * The layout of the panels for a requested layout. The requested layout can lack a panel, and it
 * can have a panel that is gone.
 * - A panel with a requested size keeps it while the other panels can fill the remainder.
 * - A panel with no requested size takes its `defaultSize`.
 * - The panels with neither share the remainder in equal parts.
 * - When there is no remainder to share, each such panel takes 100 / n, and the panels with a
 *   requested size keep their ratio in the space that stays.
 */
export function resolveLayout(panels: readonly PanelConstraints[], requested: Layout = {}): Layout {
  if (panels.length === 0) {
    return {};
  }
  const kept = panels.filter((panel) => Object.hasOwn(requested, panel.id));
  const added = panels.filter((panel) => !Object.hasOwn(requested, panel.id));
  const unsized = added.filter((panel) => panel.defaultSize === undefined);
  const keptTotal = sum(kept.map((panel) => sizeOf(requested, panel)));
  const defaultTotal = sum(added.map((panel) => panel.defaultSize ?? 0));
  const free = 100 - keptTotal - defaultTotal;
  const keepsRequested = free > 0 && unsized.length > 0;
  const share = keepsRequested ? free / unsized.length : 100 / panels.length;
  const room = keepsRequested
    ? keptTotal
    : Math.max(100 - defaultTotal - share * unsized.length, 0);
  return validateLayout(
    panels,
    Object.fromEntries([
      ...added.map((panel) => [panel.id, panel.defaultSize ?? share]),
      ...kept.map((panel) => [
        panel.id,
        keptTotal > 0 ? (sizeOf(requested, panel) / keptTotal) * room : room / kept.length,
      ]),
    ]),
  );
}

/**
 * Moves the handle after the panel `pivot` by `delta` percent, from the layout `start`.
 * A positive delta grows the panel `pivot`. A negative delta grows the panel `pivot + 1`.
 * Only the panel beside the handle grows. The panels on the other side shrink, nearest first.
 * A locked panel does not grow or shrink: the nearest panel behind it grows or shrinks in its place.
 * A move that the constraints refuse returns `start`.
 */
export function adjustLayout(
  panels: readonly PanelConstraints[],
  start: Layout,
  pivot: number,
  delta: number,
  { exact = false, push = true, only }: AdjustOptions = {},
): Layout {
  const step = delta > 0 ? 1 : -1;
  let growIndex = delta > 0 ? pivot : pivot + 1;
  // The panel behind a locked panel grows in its place.
  while (push && panels[growIndex]?.locked) {
    growIndex -= step;
  }
  const growing = panels[growIndex];
  const beyond =
    delta > 0
      ? panels.slice(pivot + 1).map((panel, offset) => ({ panel, index: pivot + 1 + offset }))
      : panels
          .slice(0, pivot + 1)
          .map((panel, index) => ({ panel, index }))
          .reverse();
  const shrinking = push ? beyond : beyond.slice(0, 1);
  if (
    !Number.isFinite(delta) ||
    delta === 0 ||
    growing === undefined ||
    growing.locked ||
    shrinking.length === 0
  ) {
    return start;
  }
  const growingStart = sizeOf(start, growing);
  const wanted = resolveSize(growing, growingStart + Math.abs(delta), 'grow', exact) - growingStart;
  if (wanted <= 0) {
    return start;
  }
  const next: Layout = { ...start };
  let taken = 0;
  for (const { panel, index } of shrinking) {
    if (taken >= wanted) {
      break;
    }
    if (panel.locked) {
      continue;
    }
    const size = sizeOf(start, panel);
    let shrunk = resolveSize(panel, size - (wanted - taken), 'shrink', exact);
    // An action does not collapse a panel that it did not name.
    if (only !== undefined && only !== index && size >= panel.minSize) {
      shrunk = Math.max(shrunk, panel.minSize);
    }
    // A collapse can take more than the growing panel has room for. The panel then stays at its
    // least size.
    if (growingStart + taken + (size - shrunk) > growing.maxSize) {
      shrunk = Math.max(shrunk, panel.minSize);
    }
    shrunk = Math.min(shrunk, size);
    taken += size - shrunk;
    next[panel.id] = shrunk;
  }
  const grown = growingStart + taken;
  // The growing panel cannot stop between its collapsed size and its least size.
  if (taken <= 0 || (grown < growing.minSize && grown !== growing.collapsedSize)) {
    return start;
  }
  next[growing.id] = grown;
  return toLayout(panels.map((panel) => ({ id: panel.id, size: sizeOf(next, panel) })));
}

/**
 * Gives the panel `index` the size `size`, with the handle after the panel `pivot`. The handle is
 * the one before the panel or the one after it. The move is `exact`.
 */
export function adjustLayoutToSize(
  panels: readonly PanelConstraints[],
  layout: Layout,
  pivot: number,
  index: number,
  size: number,
  options: Omit<AdjustOptions, 'exact'> = {},
): Layout {
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- A caller gives the index of a panel in `panels`.
  const panel = panels[index]!;
  const delta = (size - sizeOf(layout, panel)) * (index === pivot ? 1 : -1);
  return adjustLayout(panels, layout, pivot, delta, { ...options, exact: true });
}

/**
 * The least and the greatest size of the panel `primary` that the handle after the panel `pivot`
 * can give it. A collapsible panel can go to its collapsed size.
 */
export function getHandleRange(
  panels: readonly PanelConstraints[],
  layout: Layout,
  pivot: number,
  primary: PanelConstraints,
  push = true,
): { min: number; max: number } {
  const sizes = [-100, 100].map((delta) =>
    sizeOf(adjustLayout(panels, layout, pivot, delta, { exact: true, push }), primary),
  );
  return { min: Math.min(...sizes), max: Math.max(...sizes) };
}

/**
 * Whether the handle after the panel `pivot` is at an end of its travel. `atMin`: the panel before
 * the handle is at the least size that the handle can give it. `atMax`: it is at the greatest size.
 */
export function getHandleLimits(
  panels: readonly PanelConstraints[],
  layout: Layout,
  pivot: number,
  push = true,
): { atMin: boolean; atMax: boolean } {
  const panel = panels[pivot];
  if (panel === undefined || panels[pivot + 1] === undefined) {
    return { atMin: true, atMax: true };
  }
  const { min, max } = getHandleRange(panels, layout, pivot, panel, push);
  const size = sizeOf(layout, panel);
  return { atMin: size <= min, atMax: size >= max };
}

export function areLayoutsEqual(a: Layout, b: Layout): boolean {
  return hasSamePanels(a, b) && Object.entries(a).every(([id, size]) => b[id] === size);
}

export function hasSamePanels(a: Layout, b: Layout): boolean {
  const ids = Object.keys(a);
  return ids.length === Object.keys(b).length && ids.every((id) => Object.hasOwn(b, id));
}

/**
 * The layout that a change of `shown` makes for the root. A panel that is not mounted keeps its
 * entry in `requested`, and the panels that are mounted share the rest. A panel that mounts again
 * then comes back at its size.
 */
export function toRequestedLayout(shown: Layout, requested: Layout): Layout {
  const unmounted = Object.entries(requested)
    .filter(([id]) => !Object.hasOwn(shown, id))
    .map(([id, size]) => ({ id, size: round(size) }));
  const room = 100 - sum(unmounted.map((entry) => entry.size));
  // Sizes that leave no room cannot belong to the panels that are mounted: the layout forgets them.
  if (unmounted.length === 0 || room <= 0) {
    return shown;
  }
  // The rounding error goes to a mounted panel. A panel that is not mounted then keeps its size
  // through each change, and it comes back at that size.
  return {
    ...Object.fromEntries(unmounted.map(({ id, size }) => [id, size])),
    ...toLayout(
      Object.entries(shown).map(([id, size]) => ({ id, size: (size * room) / 100 })),
      room,
    ),
  };
}
