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
  /** In percent. */
  defaultSize: number | undefined;
}

interface PanelSize {
  id: string;
  size: number;
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

function toLayout(entries: readonly PanelSize[]): Layout {
  const rounded = entries.map(({ id, size }) => ({ id, size: round(size) }));
  const largestSize = Math.max(...rounded.map((entry) => entry.size));
  const largest = rounded.find((entry) => entry.size === largestSize);
  // The rounding error goes to the largest panel, so the sum is exactly 100.
  if (largest) {
    largest.size = round(largest.size + (100 - sum(rounded.map((entry) => entry.size))));
  }
  return Object.fromEntries(rounded.map(({ id, size }) => [id, size]));
}

export function resolveSize(panel: PanelConstraints, wanted: number): number {
  return clamp(wanted, panel.minSize, panel.maxSize);
}

/**
 * Puts each size inside its constraints, then gives the remainder to the panels that have room, in
 * their sequence.
 */
export function validateLayout(panels: readonly PanelConstraints[], layout: Layout): Layout {
  const entries = panels.map((panel) => ({
    panel,
    size: resolveSize(panel, sizeOf(layout, panel)),
  }));
  let remainder = 100 - sum(entries.map((entry) => entry.size));
  for (const entry of entries) {
    if (Math.abs(remainder) <= EPSILON) {
      break;
    }
    const next = clamp(entry.size + remainder, entry.panel.minSize, entry.panel.maxSize);
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
    (sum(panels.map((panel) => panel.minSize)) <= 100 + EPSILON &&
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
 * A move that the constraints refuse returns `start`.
 */
export function adjustLayout(
  panels: readonly PanelConstraints[],
  start: Layout,
  pivot: number,
  delta: number,
): Layout {
  const growing = panels[delta > 0 ? pivot : pivot + 1];
  const shrinking = delta > 0 ? panels.slice(pivot + 1) : panels.slice(0, pivot + 1).reverse();
  if (!Number.isFinite(delta) || delta === 0 || growing === undefined || shrinking.length === 0) {
    return start;
  }
  const growingStart = sizeOf(start, growing);
  const wanted = resolveSize(growing, growingStart + Math.abs(delta)) - growingStart;
  if (wanted <= 0) {
    return start;
  }
  const next: Layout = { ...start };
  let taken = 0;
  for (const panel of shrinking) {
    if (taken >= wanted) {
      break;
    }
    const size = sizeOf(start, panel);
    const shrunk = Math.min(resolveSize(panel, size - (wanted - taken)), size);
    taken += size - shrunk;
    next[panel.id] = shrunk;
  }
  if (taken <= 0) {
    return start;
  }
  next[growing.id] = growingStart + taken;
  return toLayout(panels.map((panel) => ({ id: panel.id, size: sizeOf(next, panel) })));
}

/**
 * The least and the greatest size of the panel `primary` that the handle after the panel `pivot`
 * can give it.
 */
export function getHandleRange(
  panels: readonly PanelConstraints[],
  layout: Layout,
  pivot: number,
  primary: PanelConstraints,
): { min: number; max: number } {
  const sizes = [-100, 100].map((delta) =>
    sizeOf(adjustLayout(panels, layout, pivot, delta), primary),
  );
  return { min: Math.min(...sizes), max: Math.max(...sizes) };
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
  const unmounted = Object.entries(requested).filter(([id]) => !Object.hasOwn(shown, id));
  const unmountedTotal = sum(unmounted.map(([, size]) => size));
  // Sizes that leave no room cannot belong to the panels that are mounted: the layout forgets them.
  if (unmounted.length === 0 || unmountedTotal >= 100) {
    return shown;
  }
  const scale = (100 - unmountedTotal) / 100;
  return toLayout([
    ...unmounted.map(([id, size]) => ({ id, size })),
    ...Object.entries(shown).map(([id, size]) => ({ id, size: size * scale })),
  ]);
}
