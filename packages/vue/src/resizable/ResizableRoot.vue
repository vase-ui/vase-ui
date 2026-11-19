<script setup lang="ts">
import {
  computed,
  inject,
  mergeProps,
  onMounted,
  provide,
  reactive,
  readonly,
  shallowReactive,
  shallowRef,
  useAttrs,
  watch,
} from 'vue';
import { createChangeEventDetails } from '../common/changeEventDetails';
import { byDocumentOrder, useElement } from '../common/element';
import { useModel } from '../common/model';
import { warn } from '../common/warn';
import { tabbable } from '../utils/popups/focus/tabbable';
import {
  adjustLayoutToSize,
  applyFixedSizes,
  areConstraintsFeasible,
  areLayoutsEqual,
  formatSize,
  isCollapsed,
  isLength,
  isSize,
  isViewportLength,
  normalizeLayout,
  parseSize,
  resolveLayout,
  SIZE_FORMS,
  takePins,
  toEventLayout,
  type Layout,
  type PanelConstraints,
  type Sizes,
} from './layout';
import { getMeasurement, isSameMeasurement, readMeasurement, type RootMeasurement } from './measure';
import { rootKey, type HandleMove, type RootHandle, type RootPanel, type Size } from './root';
import type {
  ResizableLayout,
  ResizableRootChangeEventDetails,
  ResizableRootChangeEventReason,
  ResizableRootCommitEventDetails,
  ResizableRootProps,
  ResizableRootState,
} from './types';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<ResizableRootProps>(), {
  modelValue: undefined,
  defaultLayout: undefined,
  orientation: 'horizontal',
  step: 1,
  largeStep: 10,
  dragStep: undefined,
  pushPanels: true,
  resizeMode: 'live',
});
const emit = defineEmits<{
  /** The user changes the layout. `details.cancel()` keeps the layout. */
  layoutChange: [layout: ResizableLayout, details: ResizableRootChangeEventDetails];
  /**
   * Comes after `layoutChange`, unless a listener cancelled it. Also comes alone after a method of a
   * panel, and after a panel that mounts with no entry.
   */
  'update:modelValue': [layout: ResizableLayout];
  /** The user ends a change: the release of a drag, a key, a double click. */
  layoutCommitted: [layout: ResizableLayout, details: ResizableRootCommitEventDetails];
  draggingChange: [dragging: boolean];
}>();
defineSlots<{
  default?(scope: {
    state: ResizableRootState;
    /** The size of each mounted panel in percent, from the mount. */
    sizes: Readonly<Record<string, number>>;
  }): unknown;
  element?(scope: {
    props: Record<string, unknown>;
    elementRef: (target: unknown) => void;
    state: ResizableRootState;
  }): unknown;
}>();

const attrs = useAttrs();
const { element, setElement } = useElement<HTMLElement>();
// A root in a panel of another root gives F6 to that root at its end.
const outer = inject(rootKey, null);

const EMPTY: Sizes = Object.freeze({});
const { value: given, setOwn } = useModel<Sizes>(
  () => (props.modelValue === null ? EMPTY : props.modelValue),
  props.defaultLayout ?? EMPTY,
);
// The first sizes for a double click. A later change of `defaultLayout` has no effect.
const firstLayout = props.defaultLayout ?? EMPTY;

const mounted = shallowRef(false);
const dragging = shallowRef(false);
// What the root read from the page. A server, the first client render and a root that has had
// no room for its panels have none.
const measurement = shallowRef<RootMeasurement>();
// The pixels of each fixed panel. At a new panel space each fixed panel takes its pixels, and the
// other panels share the rest.
const pins = shallowRef<Readonly<Record<string, number>>>({});
const pendingLayout = shallowRef<Layout>();
const direction = shallowRef<'ltr' | 'rtl'>(attrs.dir === 'rtl' ? 'rtl' : 'ltr');

type Part = RootPanel | RootHandle;
// The parts in the order of their `setup`.
const parts = shallowReactive<Part[]>([]);
// From the mount, the parts whose elements the root element contains, in the order of the document.
const present = shallowRef<readonly Part[]>([]);
const ordered = computed(() => (mounted.value ? present.value : parts));
const panels = computed(() => ordered.value.filter((part): part is RootPanel => 'id' in part));

function findParts() {
  const rootElement = element.value;
  if (!rootElement) return;
  const next = parts
    .filter((part) => part.element && rootElement.contains(part.element))
    .sort((a, b) => byDocumentOrder(a.element!, b.element!));
  const previous = present.value;
  if (next.length !== previous.length || next.some((part, index) => part !== previous[index])) {
    present.value = next;
  }
}

function addPart(part: Part) {
  parts.push(part);
  return () => {
    parts.splice(parts.indexOf(part), 1);
  };
}

function measurementFor(id?: string) {
  return measurement.value && getMeasurement(measurement.value, id);
}

// The percent of a `defaultSize` in a length at the first measurement after the mount of its
// panel. The panel keeps that percent, so it scales with the root as a percent does. A double
// click reads the length again, so it gives the pixels.
const firstDefaultSizes = new WeakMap<RootPanel, number>();

function buildConstraints(useFirstDefaultSizes: boolean): PanelConstraints[] {
  return panels.value.map((panel) => {
    const panelMeasurement = measurementFor(panel.id);
    const toPercent = (size: unknown) => parseSize(size, panelMeasurement);
    return {
      id: panel.id,
      minSize: toPercent(panel.minSize) ?? 0,
      maxSize: toPercent(panel.maxSize) ?? 100,
      collapsible: panel.collapsible,
      collapsedSize: toPercent(panel.collapsedSize) ?? 0,
      defaultSize:
        (useFirstDefaultSizes ? firstDefaultSizes.get(panel) : undefined) ??
        toPercent(panel.defaultSize),
      collapseThreshold: toPercent(panel.collapseThreshold),
      locked: panel.disabled,
      fixed: panel.rootResizeBehavior === 'fixed',
      priority: panel.rootResizePriority,
      snapPoints: panel.snapPoints?.flatMap((point) => toPercent(point) ?? []),
      snapTolerance: toPercent(panel.snapTolerance) ?? toPercent('10px'),
    };
  });
}

const constraints = computed(() => buildConstraints(true));
const fixedIds = computed(
  () => new Set(constraints.value.filter((panel) => panel.fixed).map((panel) => panel.id)),
);

function normalize(sizes: Sizes) {
  return normalizeLayout(sizes, fixedIds.value, measurementFor);
}

function entry(id: string): Size | undefined {
  const value = Object.hasOwn(given.value, id) ? given.value[id] : undefined;
  return isSize(value) ? value : undefined;
}

// The layout that the user or the app asked for, in percent. The root reads a length at the first
// measurement and at each new layout, so a new panel space does not move a panel that is not
// fixed.
const requested = shallowRef(normalize(given.value));

// The panels whose first size is a length, before the first measurement. A server and the first
// client render cannot give such a panel a size in percent.
const lengths = computed<ReadonlyMap<string, string>>(() => {
  if (measurement.value) return new Map();
  return new Map(
    panels.value.flatMap((panel) => {
      const first = entry(panel.id) ?? panel.defaultSize;
      return isLength(first) ? [[panel.id, first.trim()] as const] : [];
    }),
  );
});

// The requested sizes inside the constraints. A panel that waits for the first measurement has no
// size, and the other panels share the room.
const resolved = computed<Layout>(() => {
  const { layout, lengths: lengthIds } = requested.value;
  if (lengths.value.size === 0) return resolveLayout(constraints.value, layout, lengthIds);
  const sized = resolveLayout(
    constraints.value.filter((panel) => !lengths.value.has(panel.id)),
    layout,
    lengthIds,
  );
  return Object.fromEntries(
    constraints.value.map((panel) => [
      panel.id,
      lengths.value.has(panel.id) ? 0 : (sized[panel.id] ?? 0),
    ]),
  );
});

const shown = computed<Layout>(() =>
  measurement.value
    ? applyFixedSizes(constraints.value, resolved.value, pins.value, measurement.value.space)
    : resolved.value,
);

// A fixed panel takes the pixels of its size in `layout`. `exact` has the pixels of a length,
// which win over the pixels of the percent.
function takePinsFrom(layout: Layout, exact: Readonly<Record<string, number>>) {
  if (!measurement.value) return;
  pins.value = {
    ...pins.value,
    ...takePins(constraints.value, layout, measurement.value.space),
    ...exact,
  };
}

function acceptGiven() {
  const next = normalize(given.value);
  requested.value = next;
  takePinsFrom(resolved.value, next.pins);
}

// `sync`, so that a drag reads the new layout at its next move. A new object with equal entries
// changes nothing, so a fixed panel does not take new pixels at each render of the parent.
watch(
  given,
  (next, previous) => {
    if (!areLayoutsEqual(next, previous)) acceptGiven();
  },
  { flush: 'sync' },
);

// A panel that mounts as a fixed panel, or becomes one, takes the pixels that it has.
watch(
  () => constraints.value.filter((panel) => panel.fixed && !Object.hasOwn(pins.value, panel.id)),
  (unpinned) => {
    if (unpinned.length > 0 && measurement.value) {
      pins.value = { ...pins.value, ...takePins(unpinned, shown.value, measurement.value.space) };
    }
  },
);

// The size that each panel had before it collapsed, for `expand()` and Enter.
const sizesBeforeCollapse = new Map<string, number>();
// The layout at the start of the drag that runs. A panel that a drag collapses gets the size from
// the start of the drag.
let layoutBeforeDrag: Layout | undefined;

// A watcher sees each collapse, also one that the layout of the app gives. It is `sync`, so an
// `expand()` right after a `collapse()` finds the size.
watch(
  () => (mounted.value ? shown.value : undefined),
  (after, before) => {
    if (!after || !before) return;
    const start = layoutBeforeDrag ?? before;
    for (const panel of constraints.value) {
      const sizeBefore = start[panel.id];
      const sizeAfter = after[panel.id];
      if (
        sizeBefore !== undefined &&
        sizeAfter !== undefined &&
        !isCollapsed(panel, sizeBefore) &&
        isCollapsed(panel, sizeAfter)
      ) {
        sizesBeforeCollapse.set(panel.id, sizeBefore);
      }
    }
  },
  { flush: 'sync' },
);

// One object for the life of the root, so that only a template that reads an entry renders again
// at a move. It has no prototype, so a panel id such as `__proto__` is a key as each other.
const sizes = reactive<Record<string, number>>(Object.create(null));
watch(
  () => (mounted.value ? shown.value : undefined),
  (layout) => {
    if (!layout) return;
    for (const id of Object.keys(sizes)) if (!Object.hasOwn(layout, id)) delete sizes[id];
    for (const [id, size] of Object.entries(layout)) if (sizes[id] !== size) sizes[id] = size;
  },
);
const shownSizes = readonly(sizes);

function eventLayout(layout: Layout) {
  return toEventLayout(
    layout,
    requested.value.layout,
    given.value,
    fixedIds.value,
    measurement.value?.space,
  );
}

function changeLayout(layout: Layout, details: ResizableRootChangeEventDetails) {
  const next = eventLayout(layout);
  emit('layoutChange', next, details);
  if (details.isCanceled) return undefined;
  setOwn(next);
  emit('update:modelValue', next);
  return next;
}

// A change that no user made gives `update:modelValue` alone, as a native reset does.
function updateLayout(layout: Layout) {
  const next = eventLayout(layout);
  setOwn(next);
  emit('update:modelValue', next);
}

function commitLayout(layout: ResizableLayout, reason: ResizableRootChangeEventReason, event: Event) {
  emit('layoutCommitted', layout, { reason, event });
}

function readDirection() {
  if (element.value) {
    direction.value = getComputedStyle(element.value).direction === 'rtl' ? 'rtl' : 'ltr';
  }
  return direction.value;
}

// A root with no room for its panels, such as a root with `display: none`, keeps its last
// measurement. It has its pixels again when it shows.
function measure() {
  const rootElement = element.value;
  if (!rootElement) return undefined;
  findParts();
  readDirection();
  const next = readMeasurement(
    rootElement,
    panels.value.map((panel) => ({ id: panel.id, element: panel.element })),
    props.orientation,
  );
  if (!next) return undefined;
  for (const panel of panels.value) {
    if (isLength(panel.defaultSize) && !firstDefaultSizes.has(panel)) {
      firstDefaultSizes.set(panel, parseSize(panel.defaultSize, getMeasurement(next, panel.id))!);
    }
  }
  const previous = measurement.value;
  if (!previous || !isSameMeasurement(previous, next)) measurement.value = next;
  // The first measurement gives each length its percent and each fixed panel its pixels.
  if (!previous) acceptGiven();
  return measurement.value;
}

// A key and a method need the room of the panels, and no length that waits.
function canChange() {
  return measure() !== undefined && lengths.value.size === 0;
}

function findPanel(id: string) {
  const index = constraints.value.findIndex((panel) => panel.id === id);
  const panel = constraints.value[index];
  const size = shown.value[id];
  return panel && size !== undefined ? { panel, index, size } : undefined;
}

// Gives the panel `index` the size `size` with a move of a handle. A key and a double click give
// `move`, and they push the panels as `pushPanels` says. A method gives no `move`: it moves the
// handle after the panel, or the one before the last panel, and it pushes the panels. A method
// also moves a disabled panel.
function resizeWithHandle(
  index: number,
  size: number,
  only: number | undefined,
  move: HandleMove | undefined,
) {
  const unlocked = constraints.value.map((panel, panelIndex) =>
    panelIndex === index ? { ...panel, locked: false } : panel,
  );
  const next = adjustLayoutToSize(
    unlocked,
    shown.value,
    move?.pivot ?? (index < unlocked.length - 1 ? index : index - 1),
    index,
    size,
    { only, push: !move || props.pushPanels },
  );
  if (areLayoutsEqual(next, shown.value)) return false;
  if (!move) {
    updateLayout(next);
    return true;
  }
  const applied = changeLayout(next, createChangeEventDetails(move.reason, move.event));
  if (applied) commitLayout(applied, move.reason, move.event);
  return true;
}

function collapsePanel(id: string, move?: HandleMove) {
  const found = canChange() ? findPanel(id) : undefined;
  if (found?.panel.collapsible && !isCollapsed(found.panel, found.size)) {
    resizeWithHandle(found.index, found.panel.collapsedSize, found.index, move);
  }
}

function expandPanel(id: string, move?: HandleMove) {
  const found = canChange() ? findPanel(id) : undefined;
  if (found && isCollapsed(found.panel, found.size)) {
    resizeWithHandle(found.index, sizesBeforeCollapse.get(id) ?? found.panel.minSize, -1, move);
  }
}

function resizePanel(id: string, size: Size) {
  const found = canChange() ? findPanel(id) : undefined;
  const percent = parseSize(size, measurementFor(id));
  if (found && percent !== undefined) resizeWithHandle(found.index, percent, found.index, undefined);
}

// The first layout, as the panels show it now. A length has its percent in the present panel
// space, and a fixed panel the pixels of that layout.
function readFirstLayout(): Layout {
  const { layout, pins: exact, lengths: lengthIds } = normalize(firstLayout);
  const first = resolveLayout(buildConstraints(false), layout, lengthIds);
  const space = measurement.value?.space;
  return space === undefined
    ? first
    : applyFixedSizes(
        constraints.value,
        first,
        { ...takePins(constraints.value, first, space), ...exact },
        space,
      );
}

function resetPanel(id: string, move: HandleMove) {
  const found = canChange() ? findPanel(id) : undefined;
  const first = found && readFirstLayout()[id];
  return first !== undefined && resizeWithHandle(found!.index, first, undefined, move);
}

function startDrag() {
  if (dragging.value) return false;
  layoutBeforeDrag = shown.value;
  dragging.value = true;
  emit('draggingChange', true);
  return true;
}

function endDrag() {
  if (!dragging.value) return;
  layoutBeforeDrag = undefined;
  pendingLayout.value = undefined;
  dragging.value = false;
  emit('draggingChange', false);
}

// The index in `panels` of the panel before each handle, or -1 with no panel on one side.
const pivots = computed(() => {
  const result = new Map<RootHandle, number>();
  let index = -1;
  for (const part of ordered.value) {
    if ('id' in part) index += 1;
    else result.set(part, index);
  }
  for (const [handle, pivot] of result) if (pivot === index) result.set(handle, -1);
  return result;
});

// A panel that mounts with no entry gives `update:modelValue` alone, when it has its place.
let knownIds = new Set<string>();
watch(
  () => (mounted.value ? constraints.value.map((panel) => panel.id) : undefined),
  (ids, previous) => {
    if (!ids) return;
    const isNew =
      previous !== undefined &&
      ids.some(
        (id) =>
          !knownIds.has(id) &&
          !Object.hasOwn(requested.value.layout, id) &&
          !lengths.value.has(id),
      );
    knownIds = new Set(ids);
    if (isNew) updateLayout(shown.value);
  },
  { flush: 'post' },
);

if (process.env.NODE_ENV !== 'production') {
  // A size that constrains the layout in a length: the window can be too small for it.
  const constraintsUseLengths = computed(() =>
    panels.value.some((panel) =>
      [panel.minSize, panel.maxSize, panel.defaultSize, panel.collapsedSize].some(isLength),
    ),
  );
  watch(
    () => [constraints.value, given.value, props.step, props.largeStep, props.dragStep] as const,
    ([current, layout]) => {
      for (const [id, size] of Object.entries(layout)) {
        if (!isSize(size)) {
          warn(
            `The layout gives the panel "${id}" the size ${formatSize(size)}, which is not valid.`,
            'The root ignores this size, so the panel takes its `defaultSize`, or an equal share of the space that is left.',
            SIZE_FORMS,
          );
        }
      }
      const rootSizes = { step: props.step, largeStep: props.largeStep, dragStep: props.dragStep };
      for (const [name, size] of Object.entries(rootSizes)) {
        if (size !== undefined && !isSize(size)) {
          warn(
            `The root has the ${name} ${formatSize(size)}, which is not valid.`,
            'The root ignores this prop.',
            SIZE_FORMS,
          );
        }
      }
      for (const panel of panels.value) {
        const panelSizes = {
          defaultSize: panel.defaultSize,
          minSize: panel.minSize,
          maxSize: panel.maxSize,
          collapsedSize: panel.collapsedSize,
          collapseThreshold: panel.collapseThreshold,
          snapTolerance: panel.snapTolerance,
          snapPoints: panel.snapPoints,
        };
        for (const [name, value] of Object.entries(panelSizes)) {
          for (const size of Array.isArray(value) ? value : [value]) {
            if (size !== undefined && !isSize(size)) {
              warn(
                `The panel "${panel.id}" has the ${name} ${formatSize(size)}, which is not valid.`,
                'The panel ignores this size.',
                SIZE_FORMS,
              );
            }
          }
        }
      }
      const ids = current.map((panel) => panel.id);
      const duplicate = ids.find((id, index) => ids.indexOf(id) !== index);
      if (duplicate !== undefined) {
        warn(
          `Two panels of one root have the id "${duplicate}".`,
          'The layout has one size for each id, so the panels cannot have sizes of their own.',
          'Give each panel an id of its own.',
        );
      }
      // A window can be too small for a length, so a root with a length does not warn.
      if (!constraintsUseLengths.value && !areConstraintsFeasible(current)) {
        warn(
          'The sizes of the panels cannot sum to 100.',
          'The minimum and maximum sizes of the panels leave no layout that fills the root.',
          'Raise a `maxSize` or lower a `minSize`.',
        );
      }
      // A length of the constraints has no size before the first measurement.
      const stuck =
        constraintsUseLengths.value && !measurement.value
          ? undefined
          : current.find((panel) => panel.collapsible && panel.minSize <= panel.collapsedSize);
      if (stuck) {
        warn(
          `The panel "${stuck.id}" is collapsible, and its \`minSize\` is not greater than its \`collapsedSize\`.`,
          'A collapsible panel collapses when it goes below its `minSize`, so this panel cannot collapse.',
          'Give the panel a `minSize` that is greater than its `collapsedSize`.',
        );
      }
      if (current.length > 0 && current.every((panel) => panel.fixed)) {
        warn(
          'Each panel of the root is fixed.',
          'A fixed panel keeps its size in pixels when the root changes size, so no panel can take the change, and each panel is proportional.',
          'Leave the `rootResizeBehavior` of one panel at `proportional`.',
        );
      }
    },
    { flush: 'post' },
  );
}

// The first control of the first panel in `items` that shows and has a control.
function findControl(items: readonly Part[]) {
  for (const item of items) {
    const size = 'id' in item ? shown.value[item.id] : undefined;
    const control = size && item.element ? tabbable(item.element)[0] : undefined;
    if (control) return control;
  }
  return undefined;
}

// F6 moves the focus to the next panel, and Shift+F6 to the previous one, as the window splitter
// pattern describes. At its end, a root in a panel of another root leaves the key to that root,
// and another root goes on from its other end.
function onKeydown(event: KeyboardEvent) {
  if (
    event.key !== 'F6' ||
    event.defaultPrevented ||
    event.ctrlKey ||
    event.altKey ||
    event.metaKey
  ) {
    return;
  }
  const items = ordered.value;
  const path = event.composedPath();
  const from = items.findIndex((item) => item.element && path.includes(item.element));
  if (from < 0) return;
  const forward = !event.shiftKey;
  const isNested =
    outer?.panels.some((panel) => element.value && panel.element?.contains(element.value)) ??
    false;
  const control =
    findControl(forward ? items.slice(from + 1) : items.slice(0, from).reverse()) ??
    (isNested
      ? undefined
      : findControl(forward ? items.slice(0, from + 1) : items.slice(from).reverse()));
  if (control) {
    control.focus();
    event.preventDefault();
  }
}

const state = computed<ResizableRootState>(() => ({
  orientation: props.orientation,
  disabled: props.disabled,
  dragging: dragging.value,
}));

function elementProps() {
  return mergeProps(
    {
      'data-orientation': props.orientation,
      'data-disabled': props.disabled ? '' : undefined,
      'data-dragging': dragging.value ? '' : undefined,
      style: {
        display: 'flex',
        flexDirection: props.orientation === 'horizontal' ? 'row' : 'column',
      },
      onKeydown,
    },
    attrs,
  );
}

onMounted(() => {
  findParts();
  readDirection();
  mounted.value = true;
});

// The parts render the layout of all the parts in the flush after the mount. The root measures
// after them, in the same flush.
watch(mounted, () => measure(), { flush: 'post' });

watch(
  () => (mounted.value ? [element.value, ...parts.map((part) => part.element)] : []),
  findParts,
  { flush: 'post' },
);

// Vue sends no event for a moved part, so the root asks the document.
watch(
  () => (mounted.value ? element.value : null),
  (rootElement, _, onCleanup) => {
    if (!rootElement) return;
    const holdsPart = (node: Node) =>
      parts.some((part) => part.element && node.contains(part.element));
    const observer = new MutationObserver((records) => {
      const moved = records.some((record) =>
        [...record.addedNodes, ...record.removedNodes].some(holdsPart),
      );
      if (moved) findParts();
    });
    observer.observe(rootElement, { childList: true, subtree: true });
    onCleanup(() => observer.disconnect());
  },
  { immediate: true },
);

// Each new panel space changes the box of a panel or of the root. A delivery of panels alone
// waits for the next frame: the root then gives a fixed panel its pixels with no loop error of
// the observer (M11).
watch(
  () => (mounted.value ? [element.value, ...panels.value.map((panel) => panel.element)] : []),
  (elements, _, onCleanup) => {
    const [rootElement] = elements;
    if (!rootElement) return;
    let frame = 0;
    const observer = new ResizeObserver((entries) => {
      if (entries.some((entry) => entry.target === rootElement)) {
        measure();
      } else {
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(() => measure());
      }
    });
    for (const observed of elements) if (observed) observer.observe(observed);
    onCleanup(() => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    });
  },
  { flush: 'post' },
);

const usesViewportLengths = computed(
  () =>
    panels.value.some((panel) =>
      [
        panel.minSize,
        panel.maxSize,
        panel.defaultSize,
        panel.collapsedSize,
        panel.collapseThreshold,
        panel.snapTolerance,
        ...(panel.snapPoints ?? []),
      ].some(isViewportLength),
    ) || [props.step, props.largeStep, props.dragStep].some(isViewportLength),
);

// A root of a fixed size gets no delivery when the window changes size.
watch(
  () => (mounted.value && usesViewportLengths.value ? element.value : null),
  (rootElement, _, onCleanup) => {
    const view = rootElement?.ownerDocument.defaultView;
    if (!view) return;
    const onResize = () => measure();
    view.addEventListener('resize', onResize);
    onCleanup(() => view.removeEventListener('resize', onResize));
  },
  { immediate: true },
);

provide(rootKey, {
  get orientation() {
    return props.orientation;
  },
  get disabled() {
    return props.disabled;
  },
  get mounted() {
    return mounted.value;
  },
  get step() {
    return parseSize(props.step, measurementFor()) ?? 1;
  },
  get largeStep() {
    return parseSize(props.largeStep, measurementFor()) ?? 10;
  },
  get dragStep() {
    return parseSize(props.dragStep, measurementFor());
  },
  get pushPanels() {
    return props.pushPanels;
  },
  get resizeMode() {
    return props.resizeMode;
  },
  get panels() {
    return panels.value;
  },
  get constraints() {
    return constraints.value;
  },
  get shown() {
    return shown.value;
  },
  get lengths() {
    return lengths.value;
  },
  get measurement() {
    return measurement.value;
  },
  get dragging() {
    return dragging.value;
  },
  get pendingLayout() {
    return pendingLayout.value;
  },
  get direction() {
    return direction.value;
  },
  entry,
  pivotOf: (handle) => pivots.value.get(handle) ?? -1,
  addPanel: addPart,
  addHandle: addPart,
  measure,
  readDirection,
  startDrag,
  endDrag,
  setPendingLayout(layout) {
    pendingLayout.value = layout;
  },
  changeLayout,
  commitLayout,
  collapsePanel,
  expandPanel,
  resizePanel,
  resetPanel,
});

defineExpose({ element });
</script>

<template>
  <slot
    v-if="$slots.element"
    name="element"
    :props="elementProps()"
    :element-ref="setElement"
    :state="state"
  />
  <div v-else v-bind="elementProps()" :ref="setElement">
    <slot :state="state" :sizes="shownSizes" />
  </div>
</template>
