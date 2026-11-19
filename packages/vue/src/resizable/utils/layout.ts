import { clamp } from '../../common/clamp';

/**
 * The size of each panel in percent of the panel space, by panel id. The sizes of a layout sum to 100.
 */
export type Layout = Record<string, number>;

/**
 * The numbers that change a size with a unit into percent of the panel space.
 */
export interface Measurement {
  /**
   * The room that the panels share on the axis of the root, in pixels. It is greater than 0.
   */
  space: number;
  /**
   * The font size of the root element of the document, in pixels.
   */
  rem: number;
  /**
   * The font size of the element that has the size, in pixels.
   */
  em: number;
  viewportWidth: number;
  viewportHeight: number;
}

/**
 * The size of each panel by panel id: a number, or a string of a number with a unit.
 * A string with no unit, or with `%`, is percent of the panel space.
 */
export type LayoutSnapshot = Record<string, number | string>;

type Length = 'px' | 'em' | 'rem' | 'vh' | 'vw';

const SIZE = /^(\d*\.?\d+)(%|px|em|rem|vh|vw)?$/;

function splitSize(value: number | string): { amount: number; unit: '%' | Length } | undefined {
  if (typeof value === 'number') {
    return Number.isFinite(value) && value >= 0 ? { amount: value, unit: '%' } : undefined;
  }
  const [, text, unit = '%'] = SIZE.exec(value.trim()) ?? [];
  return text === undefined
    ? undefined
    : { amount: Number(text), unit: isLengthUnit(unit) ? unit : '%' };
}

export const SIZE_FORMS =
  'Use a number of 0 or more, or a string of such a number with an optional unit: "%", "px", "em", "rem", "vh" or "vw".';

export function formatSize(value: unknown): string {
  return typeof value === 'string' ? `"${value}"` : String(value);
}

function readSize(value: number | string): { amount: number; unit: '%' | Length } {
  const size = splitSize(value);
  if (size === undefined) {
    throw new Error(
      `Vase UI: The size ${formatSize(value)} is not valid. Resizable cannot use it as a size. ${SIZE_FORMS} Examples are 30, "30%" and "200px".`,
    );
  }
  return size;
}

// The pattern of `SIZE` allows no other unit.
function isLengthUnit(unit: string): unit is Length {
  return unit !== '%';
}

function toPixels(amount: number, unit: Length, measurement: Measurement): number {
  switch (unit) {
    case 'px':
      return amount;
    case 'em':
      return amount * measurement.em;
    case 'rem':
      return amount * measurement.rem;
    case 'vh':
      return (amount / 100) * measurement.viewportHeight;
    case 'vw':
      return (amount / 100) * measurement.viewportWidth;
  }
}

/**
 * The percent of the panel space for a size. A number, and a string with no unit or with `%`, are
 * percent already. A length needs the measurement: with none, the result is `undefined`.
 * Another form throws.
 */
export function parseSize(
  value: number | string,
  measurement: Measurement | undefined,
): number | undefined {
  const { amount, unit } = readSize(value);
  if (!isLengthUnit(unit)) {
    return amount;
  }
  return measurement === undefined
    ? undefined
    : (toPixels(amount, unit, measurement) / measurement.space) * 100;
}

/**
 * The size in pixels of the panel space. It is `undefined` while there is no measurement.
 */
export function parsePixels(
  value: number | string,
  measurement: Measurement | undefined,
): number | undefined {
  if (measurement === undefined) {
    return undefined;
  }
  const { amount, unit } = readSize(value);
  return isLengthUnit(unit)
    ? toPixels(amount, unit, measurement)
    : (amount / 100) * measurement.space;
}

/**
 * Whether the value is a size that `parseSize` accepts. This function does not throw.
 */
export function isSize(value: unknown): value is number | string {
  return (typeof value === 'number' || typeof value === 'string') && splitSize(value) !== undefined;
}

/**
 * Whether the size is a length: `px`, `em`, `rem`, `vh` or `vw`. A size that is not valid is not a
 * length. This function does not throw.
 */
export function isLength(value: number | string | undefined): boolean {
  const unit = value === undefined ? undefined : splitSize(value)?.unit;
  return unit !== undefined && isLengthUnit(unit);
}

/**
 * Whether the size is a length in `vh` or `vw`, which follow the size of the window.
 */
export function isViewportLength(value: number | string | undefined): boolean {
  const unit = value === undefined ? undefined : splitSize(value)?.unit;
  return unit === 'vh' || unit === 'vw';
}

/**
 * The layout in percent that a layout of sizes gives, and the pixels that it gives to the panels
 * that keep their size in pixels. An app can read a layout from a cookie, a storage or a server, so
 * an entry that is not a size is left out. An entry that is a length has no percent while there is
 * no measurement, so it is left out too.
 */
export function normalizeLayout(
  snapshot: LayoutSnapshot,
  fixedIds: ReadonlySet<string>,
  getMeasurement: (id: string) => Measurement | undefined,
): { layout: Layout; pins: Record<string, number> } {
  const entries = Object.entries(snapshot).flatMap(([id, value]) => {
    if (!isSize(value)) {
      return [];
    }
    const measurement = getMeasurement(id);
    const percent = parseSize(value, measurement);
    return percent === undefined ? [] : [{ id, value, percent, measurement }];
  });
  return {
    layout: Object.fromEntries(entries.map(({ id, percent }) => [id, percent])),
    pins: Object.fromEntries(
      entries.flatMap(({ id, value, measurement }) => {
        const pixels =
          fixedIds.has(id) && isLength(value) ? parsePixels(value, measurement) : undefined;
        return pixels === undefined ? [] : [[id, pixels]];
      }),
    ),
  };
}

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
  /** Whether the panel keeps its size in pixels when the root changes size. */
  fixed?: boolean | undefined;
  /**
   * When the other panels cannot take a size change of the root, the fixed panel with the greater
   * number gives way first.
   */
  priority?: number | undefined;
  /** In percent. A drag that comes within `snapTolerance` of a point gives the panel that size. */
  snapPoints?: readonly number[] | undefined;
  /** In percent. */
  snapTolerance?: number | undefined;
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
  // A size that comes from sizes with decimals can have a rounding error. A size that is less than
  // `minSize` by such an error is at `minSize`.
  if (!panel.collapsible || wanted >= panel.minSize - EPSILON) {
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
    if (growingStart + taken + (size - shrunk) > growing.maxSize + EPSILON) {
      shrunk = Math.max(shrunk, panel.minSize);
    }
    shrunk = Math.min(shrunk, size);
    taken += size - shrunk;
    next[panel.id] = shrunk;
  }
  const grown = growingStart + taken;
  // The growing panel cannot stop between its collapsed size and its least size.
  if (
    taken <= 0 ||
    (grown < growing.minSize - EPSILON && Math.abs(grown - growing.collapsedSize) > EPSILON)
  ) {
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
 * The physical limits of the handle. A horizontal right-to-left layout reverses its two ends.
 */
export function getHandleLimits(
  panels: readonly PanelConstraints[],
  layout: Layout,
  pivot: number,
  push = true,
  reversed = false,
): { atMin: boolean; atMax: boolean } {
  const panel = panels[pivot];
  if (panel === undefined || panels[pivot + 1] === undefined) {
    return { atMin: true, atMax: true };
  }
  const { min, max } = getHandleRange(panels, layout, pivot, panel, push);
  const size = sizeOf(layout, panel);
  return reversed
    ? { atMin: size >= max, atMax: size <= min }
    : { atMin: size <= min, atMax: size >= max };
}

/**
 * The pixels of each fixed panel for a layout at a panel space of `space` pixels.
 */
export function takePins(
  panels: readonly PanelConstraints[],
  layout: Layout,
  space: number,
): Record<string, number> {
  return Object.fromEntries(
    panels
      .filter((panel) => panel.fixed)
      .map((panel) => [panel.id, (sizeOf(layout, panel) / 100) * space]),
  );
}

/**
 * Gives `total` percent to the panels in the ratio that they have in `layout`, as CSS flexbox
 * does. A panel that a least or a greatest size holds keeps that size. The other panels share what
 * is left. A collapsed panel keeps its collapsed size.
 */
function shareInRatio(panels: readonly PanelConstraints[], layout: Layout, total: number): Layout {
  // Each panel has an entry from the start, so an id such as `__proto__` is a key and not a prototype.
  const shares: Layout = Object.fromEntries(panels.map((panel) => [panel.id, 0]));
  let remaining = total;
  let free: PanelConstraints[] = [];
  for (const panel of panels) {
    if (isCollapsed(panel, sizeOf(layout, panel))) {
      shares[panel.id] = panel.collapsedSize;
      remaining -= panel.collapsedSize;
    } else {
      free.push(panel);
    }
  }
  while (free.length > 0) {
    const weight = sum(free.map((panel) => sizeOf(layout, panel)));
    const proposals = free.map((panel) => ({
      panel,
      size: weight > 0 ? (sizeOf(layout, panel) / weight) * remaining : remaining / free.length,
    }));
    const violation = sum(
      proposals.map(({ panel, size }) => clamp(size, panel.minSize, panel.maxSize) - size),
    );
    // As flexbox does, hold only the panels that break the kind of constraint with the larger total.
    // The other panels then share the rest again. With no such panel, each panel is held, so the
    // loop always ends.
    const violators = proposals.filter(({ panel, size }) =>
      violation > EPSILON ? size < panel.minSize : violation < -EPSILON && size > panel.maxSize,
    );
    const held = violators.length > 0 ? violators : proposals;
    for (const { panel, size } of held) {
      shares[panel.id] = clamp(size, panel.minSize, panel.maxSize);
      remaining -= sizeOf(shares, panel);
    }
    free = free.filter((panel) => !held.some((entry) => entry.panel === panel));
  }
  return shares;
}

/**
 * The layout after a change of the panel space. Each fixed panel that has a pin takes its pin, in
 * percent of the new space. The other panels share the rest in the ratio that they have in `layout`,
 * and a collapsed panel stays collapsed. When the other panels cannot take the change, the fixed
 * panels take it: the greater `priority` first, then the sequence of the panels.
 * With no panel that is not fixed, or with no space, the layout stays.
 */
export function applyFixedSizes(
  panels: readonly PanelConstraints[],
  layout: Layout,
  pins: Readonly<Record<string, number>>,
  space: number,
): Layout {
  const fixed = panels.filter((panel) => panel.fixed && Object.hasOwn(pins, panel.id));
  const others = panels.filter((panel) => !fixed.includes(panel));
  if (fixed.length === 0 || others.length === 0 || space <= 0) {
    return layout;
  }
  const wanted: Layout = Object.fromEntries(panels.map((panel) => [panel.id, 0]));
  for (const panel of fixed) {
    wanted[panel.id] = isCollapsed(panel, sizeOf(layout, panel))
      ? panel.collapsedSize
      : ((pins[panel.id] ?? 0) / space) * 100;
  }
  Object.assign(
    wanted,
    shareInRatio(
      others,
      layout,
      Math.max(100 - sum(fixed.map((panel) => sizeOf(wanted, panel))), 0),
    ),
  );
  let remainder = 100 - sum(panels.map((panel) => sizeOf(wanted, panel)));
  for (const panel of [...fixed].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))) {
    if (Math.abs(remainder) <= EPSILON) {
      break;
    }
    const size = sizeOf(wanted, panel);
    const next = isCollapsed(panel, size)
      ? size
      : clamp(size + remainder, panel.minSize, panel.maxSize);
    remainder -= next - size;
    wanted[panel.id] = next;
  }
  return validateLayout(panels, wanted);
}

/**
 * The delta of a drag, in percent, after the drag step and the snap points. With a drag step, the
 * delta is the nearest multiple of it. Then the panel before the handle can snap. If it does not,
 * the panel after the handle can snap. The nearest snap point that is inside the tolerance of the
 * panel gives the panel that size. A snap point outside the least and the greatest size of the panel
 * is not used. A locked panel does not snap, because its size does not change.
 */
export function snapDelta(
  panels: readonly PanelConstraints[],
  start: Layout,
  pivot: number,
  delta: number,
  dragStep?: number,
): number {
  const stepped =
    dragStep === undefined || dragStep <= 0 ? delta : Math.round(delta / dragStep) * dragStep;
  for (const [index, sign] of [
    [pivot, 1],
    [pivot + 1, -1],
  ] as const) {
    const panel = panels[index];
    if (panel === undefined || panel.locked) {
      continue;
    }
    const size = sizeOf(start, panel) + sign * stepped;
    const points = (panel.snapPoints ?? []).filter(
      (point) =>
        point >= panel.minSize &&
        point <= panel.maxSize &&
        Math.abs(size - point) <= (panel.snapTolerance ?? 0),
    );
    const nearest = points.sort((a, b) => Math.abs(size - a) - Math.abs(size - b))[0];
    if (nearest !== undefined) {
      return stepped + sign * (nearest - size);
    }
  }
  return stepped;
}

export function areLayoutsEqual(
  a: Readonly<Record<string, number | string>>,
  b: Readonly<Record<string, number | string>>,
): boolean {
  return hasSamePanels(a, b) && Object.entries(a).every(([id, size]) => b[id] === size);
}

export function hasSamePanels(
  a: Readonly<Record<string, unknown>>,
  b: Readonly<Record<string, unknown>>,
): boolean {
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
