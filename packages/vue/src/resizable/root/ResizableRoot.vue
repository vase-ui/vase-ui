<script lang="ts">
import type { HTMLAttributes } from 'vue';
import type {
  VaseUIChangeEventDetails,
  VaseUIGenericEventDetails,
} from '../../internals/createBaseUIEventDetails';
import { REASONS } from '../../internals/reasons';
import type { Orientation, VaseUIComponentProps, WithVaseUIEvent } from '../../internals/types';
import type { Layout } from '../utils/layout';
import type { LayoutSnapshot } from '../utils/parseSize';

/**
 * The size of each panel in percent of the panel space, by panel `id`. The sizes sum to 100.
 */
export type ResizableRootLayout = Layout;

/**
 * The size of each panel by panel `id`. A size is a number, or a string of a number with a unit:
 * `'30'` and `'30%'` are percent of the panel space, and `'200px'`, `'12em'`, `'12rem'`, `'30vh'`
 * and `'30vw'` are lengths.
 */
export type ResizableRootLayoutSnapshot = LayoutSnapshot;

export interface ResizableRootState {
  /**
   * The orientation of the panels.
   */
  orientation: Orientation;
  /**
   * Whether the handles ignore user interaction.
   */
  disabled: boolean;
  /**
   * Whether the user is dragging a handle.
   */
  dragging: boolean;
}

export interface ResizableRootProps
  extends
    VaseUIComponentProps<ResizableRootState>,
    /* @vue-ignore */ Omit<WithVaseUIEvent<HTMLAttributes>, 'layout'> {
  /**
   * The orientation of the panels. A horizontal root puts the panels in a row.
   * @default 'horizontal'
   */
  orientation?: Orientation | undefined;
  /**
   * Whether the handles ignore user interaction.
   * @default false
   */
  disabled?: boolean | undefined;
  /**
   * The controlled layout: the size of each panel by panel `id`.
   * A size is a number, or a string of a number with a unit. A number, and a string with no unit or
   * with `%`, are percent of the panel space. A length (`px`, `em`, `rem`, `vh` or `vw`) turns into
   * percent of the panel space at the moment that the root reads it, and a fixed panel keeps the
   * pixels. The root reads a length when it has a measurement, so the size of a length shows after
   * the mount. The change events give percent.
   * The panels show the layout as far as their constraints allow.
   * An entry for a panel that is not mounted stays in the layout, and the panel gets its size back
   * when it mounts.
   *
   * To render an uncontrolled root, use the `defaultLayout` prop instead.
   */
  layout?: ResizableRootLayoutSnapshot | undefined;
  /**
   * The uncontrolled layout at the start. It takes the same sizes as `layout`.
   * A panel with no entry takes its `defaultSize`, or an equal share of the space that is left.
   * The `reset()` method and a double click on a handle give back the sizes of this layout: the
   * method for each panel, and the double click for the primary panel of the handle.
   *
   * To render a controlled root, use the `layout` prop instead.
   */
  defaultLayout?: ResizableRootLayoutSnapshot | undefined;
  /**
   * The size of the move of an arrow key. A size is a number, or a string of a number with a unit.
   * A number is percent of the panel space, and `em` is the font size of the root.
   * @default 1
   */
  step?: number | string | undefined;
  /**
   * The size of the move of an arrow key with Shift, and of Page Up and Page Down. It takes the
   * same sizes as `step`.
   * @default 10
   */
  largeStep?: number | string | undefined;
  /**
   * The size of the steps of a drag: a drag moves the handle to the nearest multiple of this size.
   * It takes the same sizes as `step`. A key and a method do not use it.
   */
  dragStep?: number | string | undefined;
  /**
   * Whether a move of a handle goes on into the panels after the panel beside the handle.
   * When the panel beside the handle is at its least size, the move goes on into the next panel.
   * With `false`, a move changes only the two panels beside the handle.
   * The methods of the panels and of the root ignore this prop.
   * @default true
   */
  pushPanels?: boolean | undefined;
}

export type ResizableRootChangeEventReason =
  | typeof REASONS.drag
  | typeof REASONS.keyboard
  | typeof REASONS.imperativeAction
  | typeof REASONS.none
  | 'reset';
export type ResizableRootChangeEventDetails =
  VaseUIChangeEventDetails<ResizableRootChangeEventReason>;

export type ResizableRootCommitEventReason =
  typeof REASONS.drag | typeof REASONS.keyboard | typeof REASONS.imperativeAction | 'reset';
export type ResizableRootCommitEventDetails = VaseUIGenericEventDetails<
  ResizableRootCommitEventReason,
  {
    /**
     * The layout of the event, with the size of each fixed panel in whole pixels, such as `'240px'`.
     * Give it to `layout` or to `defaultLayout`, and each fixed panel has its pixels again.
     */
    snapshot: ResizableRootLayoutSnapshot;
  }
>;

export interface ResizableRootActions {
  /**
   * Gives a copy of the layout that the panels show: the size of each panel that is mounted, in
   * percent of the panel space.
   */
  getLayout: () => ResizableRootLayout;
  /**
   * Gives each panel the size that the layout has for it, as far as the constraints of the panels
   * allow. A panel that the layout lacks takes its `defaultSize`, or an equal share of the space
   * that is left. The layout takes the same sizes as the `layout` prop.
   * The change has the reason `'imperative-action'`. It does nothing when the root has this
   * layout already.
   */
  setLayout: (layout: ResizableRootLayoutSnapshot) => void;
  /**
   * Gives the panels the layout of the `defaultLayout` prop, also in a controlled root.
   * A panel that it does not name takes its `defaultSize`, or an equal share of the space that is
   * left.
   * The change has the reason `'imperative-action'`. It does nothing when the root has that layout
   * already.
   */
  reset: () => void;
}
</script>

<script setup lang="ts">
import {
  computed,
  onActivated,
  onDeactivated,
  onMounted,
  onScopeDispose,
  provide,
  shallowRef,
  watch,
} from 'vue';
import { addEventListener } from '../../common/addEventListener';
import { EMPTY_OBJECT } from '../../common/empty';
import { useIsHydrated } from '../../common/hydration';
import { ownerWindow } from '../../common/owner';
import { useControlled } from '../../common/useControlled';
import { warn } from '../../common/warn';
import { useCompositeListContext } from '../../internals/composite/list/CompositeListContext';
import { useCompositeList } from '../../internals/composite/list/useCompositeList';
import {
  createChangeEventDetails,
  createGenericEventDetails,
} from '../../internals/createBaseUIEventDetails';
import { useDirection } from '../../internals/direction-context/DirectionContext';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useRenderElement } from '../../internals/useRenderElement';
import {
  adjustLayoutToSize,
  applyFixedSizes,
  areConstraintsFeasible,
  areLayoutsEqual,
  isCollapsed,
  resolveLayout,
  takePins,
  toRequestedLayout,
} from '../utils/layout';
import type { PanelConstraints } from '../utils/layout';
import { getMeasurement, isSameMeasurement, readMeasurement } from '../utils/measure';
import type { RootMeasurement } from '../utils/measure';
import { isLength, isViewportLength, normalizeLayout, parseSize } from '../utils/parseSize';
import { ResizableRootContext } from './ResizableRootContext';
import type { ResizableHandleMove, ResizablePanelRegistration } from './ResizableRootContext';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<ResizableRootProps>(), {
  as: 'div',
  orientation: 'horizontal',
  disabled: false,
  layout: undefined,
  defaultLayout: undefined,
  step: 1,
  largeStep: 10,
  dragStep: undefined,
  pushPanels: true,
});

const emit = defineEmits<{
  /**
   * Event handler called when the layout changes.
   * Receives the new layout as the first argument.
   * Call `eventDetails.cancel()` to keep the layout as it is.
   *
   * The `eventDetails.reason` indicates what triggered the change:
   *
   * - `'drag'` while the user drags a handle
   * - `'keyboard'` for a key on a handle
   * - `'reset'` for a double click on a handle
   * - `'imperative-action'` for a method of a panel or of the root
   * - `'none'` when a panel mounts that the layout does not name
   */
  layoutChange: [layout: ResizableRootLayout, eventDetails: ResizableRootChangeEventDetails];
  'update:layout': [layout: ResizableRootLayout];
  /**
   * Event handler called when the user ends a change of the layout: at the end of a drag that
   * changed the layout, and after a key, a double click or a method that changed it.
   * Does not fire if the layout did not change, or if a listener canceled the change.
   * **Warning**: This is a generic event, not a change event.
   *
   * The `eventDetails.reason` indicates what triggered the commit:
   *
   * - `'drag'` for a drag of a handle
   * - `'keyboard'` for a key on a handle
   * - `'reset'` for a double click on a handle
   * - `'imperative-action'` for a method of a panel or of the root
   */
  layoutCommitted: [layout: ResizableRootLayout, eventDetails: ResizableRootCommitEventDetails];
  /**
   * Event handler called when the user starts or ends a drag of a handle.
   */
  draggingChange: [dragging: boolean];
}>();

defineSlots<{
  default(props: { state: ResizableRootState }): unknown;
  render: ComponentRenderFn<HTMLProps, ResizableRootState>;
}>();

const direction = useDirection();
const dragging = shallowRef(false);

const state = computed<ResizableRootState>(() => ({
  orientation: props.orientation,
  disabled: props.disabled,
  dragging: dragging.value,
}));

// The layout that the user or the app asked for: the `layout` prop, or the layout of the last change.
const [input, setInput] = useControlled<ResizableRootLayoutSnapshot>({
  controlled: () => props.layout,
  default: () => props.defaultLayout ?? EMPTY_OBJECT,
  name: 'Resizable',
  state: 'layout',
});

// The layout at the start. A later change of `defaultLayout` has no effect.
const firstSnapshot: ResizableRootLayoutSnapshot = props.defaultLayout ?? EMPTY_OBJECT;

const registered = shallowRef<readonly ResizablePanelRegistration[]>([]);
const panels = computed(() =>
  registered.value
    .filter((panel) => !panel.deactivated.value)
    .toSorted((a, b) => a.index.value - b.index.value),
);

// What the root read from the page. A server, the first render of a client and a root that has had
// no room for its panels have none.
const measurement = shallowRef<RootMeasurement | undefined>();
// The pixels of each fixed panel. A size change of the root gives each fixed panel its pixels, and
// the other panels share the rest.
const pins = shallowRef<Readonly<Record<string, number>>>(EMPTY_OBJECT);

// The numbers that change a size into percent: those of a panel, or those of the root.
function getSizeBasis(id?: string) {
  return measurement.value === undefined ? undefined : getMeasurement(measurement.value, id);
}

const constraints = computed<PanelConstraints[]>(() =>
  panels.value.map((panel) => {
    const id = panel.id.value;
    const basis = getSizeBasis(id);
    // A length has no percent before the first measurement. The panel then has the size that it has
    // with no such constraint.
    const toPercent = (size: number | string | undefined) =>
      size === undefined ? undefined : parseSize(size, basis);
    return {
      id,
      minSize: toPercent(panel.minSize()) ?? 0,
      maxSize: toPercent(panel.maxSize()) ?? 100,
      collapsible: panel.collapsible(),
      collapsedSize: toPercent(panel.collapsedSize()) ?? 0,
      defaultSize: toPercent(panel.defaultSize),
      collapseThreshold: toPercent(panel.collapseThreshold()),
      locked: panel.disabled(),
      fixed: panel.rootResizeBehavior() === 'fixed',
      priority: panel.rootResizePriority(),
      snapPoints: panel.snapPoints()?.flatMap((point) => toPercent(point) ?? []),
      snapTolerance: toPercent(panel.snapTolerance()),
    };
  }),
);

function normalize(snapshot: ResizableRootLayoutSnapshot) {
  const fixedIds = new Set(
    constraints.value.filter((panel) => panel.fixed).map((panel) => panel.id),
  );
  return normalizeLayout(snapshot, fixedIds, getSizeBasis);
}

// The layout in percent. A length of `input` has no percent before the first measurement, so the
// layout then lacks it.
const requested = shallowRef<ResizableRootLayout>(normalize(input.value).layout);

// The panels whose first size is a length, before the first measurement. A server and the first
// render of a client cannot give such a panel a size in percent.
const lengthPanels = computed<Readonly<Record<string, string>>>(() => {
  if (measurement.value !== undefined) {
    return EMPTY_OBJECT;
  }
  return Object.fromEntries(
    panels.value.flatMap((panel) => {
      const id = panel.id.value;
      const first = Object.hasOwn(input.value, id) ? input.value[id] : panel.defaultSize;
      return typeof first === 'string' && isLength(first) ? [[id, first.trim()]] : [];
    }),
  );
});

// The layout of the requested sizes, inside the constraints. A panel that waits for the first
// measurement has no size, and the other panels share the room.
const resolved = computed<ResizableRootLayout>(() => {
  if (Object.keys(lengthPanels.value).length === 0) {
    return resolveLayout(constraints.value, requested.value);
  }
  const layout = resolveLayout(
    constraints.value.filter((panel) => !Object.hasOwn(lengthPanels.value, panel.id)),
    requested.value,
  );
  return Object.fromEntries(constraints.value.map((panel) => [panel.id, layout[panel.id] ?? 0]));
});

// The layout that the panels show: the fixed panels have their pixels in the present panel space.
const shown = computed<ResizableRootLayout>(() =>
  measurement.value === undefined
    ? resolved.value
    : applyFixedSizes(constraints.value, resolved.value, pins.value, measurement.value.space),
);

// A fixed panel takes the pixels that its size in `layout` has in the present panel space. `exact`
// has the pixels of a size that was a length: they win over the pixels of the percent.
function takePinsFrom(layout: ResizableRootLayout, exact: Readonly<Record<string, number>>) {
  if (measurement.value !== undefined) {
    pins.value = {
      ...pins.value,
      ...takePins(constraints.value, layout, measurement.value.space),
      ...exact,
    };
  }
}

// A length turns into percent when the root reads `input`, and a percent stays as it is. The root
// reads `input` at the first measurement and at each change of it, so a size change of the root
// does not move a panel that is not fixed, and a fixed panel takes its pixels again.
function acceptInput() {
  const { layout, pins: exact } = normalize(input.value);
  requested.value = layout;
  takePinsFrom(resolved.value, exact);
}

// The watcher is `sync`, so `requested` is right when a drag reads the layout after a move. An
// object with the same sizes, such as the one that a template literal makes at each render, is no
// change.
watch(
  input,
  (next, previous) => {
    if (!areLayoutsEqual(next, previous)) {
      acceptInput();
    }
  },
  { flush: 'sync' },
);

// A panel that mounts as a fixed panel, or becomes one, takes the pixels that it has now.
watch(
  () => constraints.value.some((panel) => panel.fixed && !Object.hasOwn(pins.value, panel.id)),
  (missing) => {
    if (missing && measurement.value !== undefined) {
      const pinless = constraints.value.filter(
        (panel) => panel.fixed && !Object.hasOwn(pins.value, panel.id),
      );
      pins.value = {
        ...pins.value,
        ...takePins(pinless, shown.value, measurement.value.space),
      };
    }
  },
);

function getSizes(panel: ResizablePanelRegistration) {
  return [
    panel.minSize(),
    panel.maxSize(),
    panel.defaultSize,
    panel.collapsedSize(),
    panel.collapseThreshold(),
    panel.snapTolerance(),
    ...(panel.snapPoints() ?? []),
  ];
}

// A size that constrains the layout, in a length: the window can be too small for it.
const constraintsUseLengths = computed(() =>
  panels.value.some((panel) =>
    [panel.minSize(), panel.maxSize(), panel.defaultSize, panel.collapsedSize()].some(isLength),
  ),
);

// A size in `vh` or `vw` follows the window.
const usesViewportLengths = computed(
  () =>
    panels.value.some((panel) => getSizes(panel).some(isViewportLength)) ||
    [props.step, props.largeStep, props.dragStep].some(isViewportLength),
);

if (process.env.NODE_ENV !== 'production') {
  // The first renders see only the panels that registered before them, so the check waits for the
  // render that follows the registrations.
  watch(
    constraints,
    (current) => {
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
        constraintsUseLengths.value && measurement.value === undefined
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

// The panels register in `setup`, before the mount. The layout of that first state is the layout
// that the consumer asked for, so it has no change event.
let mounted = false;
// `KeepAlive` takes the panels of a deactivated root out of the list, and gives them back at the
// activation. The panels are then the same, so the root keeps the ids that it knows.
let deactivated = false;
let knownIds = new Set<string>();

// Each panel and handle gets its place among the others from this list. A server gives the places
// in the order of `setup`. The list calls this function when a panel or a handle comes or goes,
// and after it sorted them. A panel that mounts with no entry in the layout of the consumer gets a
// size, and the others make room for it. The layout then names that panel. A panel that goes keeps
// its entry, so it comes back at its size.
function syncLayoutWithPanels() {
  if (deactivated) {
    return;
  }
  const ids = constraints.value.map((panel) => panel.id);
  // A panel that waits for the first measurement has no size yet, so it is not new for the layout.
  const isNew = ids.some(
    (id) =>
      !knownIds.has(id) &&
      !Object.hasOwn(requested.value, id) &&
      !Object.hasOwn(lengthPanels.value, id),
  );
  knownIds = new Set(ids);
  if (mounted && isNew) {
    changeLayout(shown.value, createChangeEventDetails(REASONS.none));
  }
}

const outerList = useCompositeListContext();
// The elements of the panels and of the handles, in the order of the document.
const items = shallowRef<(HTMLElement | null)[]>([]);
useCompositeList({ elementsRef: items, onMapChange: syncLayoutWithPanels });

onMounted(() => {
  mounted = true;
  measure();
});

onDeactivated(() => {
  deactivated = true;
});

onActivated(() => {
  deactivated = false;
});

function registerPanel(panel: ResizablePanelRegistration) {
  registered.value = [...registered.value, panel];
  onScopeDispose(() => {
    registered.value = registered.value.filter((entry) => entry !== panel);
  });
}

// The size that each panel had before a change collapsed it. `expand()` gives it back.
const sizesBeforeCollapse = new Map<string, number>();
// The layout at the start of the drag that runs. Each move of a drag starts from this layout, so a
// panel that a drag collapses gets the size from the start of the drag, for any number of moves.
let layoutBeforeDrag: ResizableRootLayout | undefined;

// Before the mount, the panels register one at a time. A layout of only some of them is not a
// change of the user or of the app, so the watcher below starts at the mount.
const isHydrated = useIsHydrated();

// A watcher, and not the change path, sees each collapse: also a collapse that the `layout` prop of
// the consumer gives. It is `sync`, so an `expand()` right after a `collapse()` finds the size.
watch(
  () => (isHydrated.value ? shown.value : undefined),
  (after, before) => {
    if (after === undefined || before === undefined || deactivated) {
      return;
    }
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

// `base` is the layout that the new layout replaces: its entries for panels that are not mounted
// stay in the layout.
function changeLayout(
  layout: ResizableRootLayout,
  details: ResizableRootChangeEventDetails,
  base: ResizableRootLayout = requested.value,
) {
  const next = toRequestedLayout(layout, base);
  emit('layoutChange', next, details);
  if (details.isCanceled) {
    return undefined;
  }
  emit('update:layout', next);
  setInput(next);
  return next;
}

// The layout of an event with the size of each fixed panel in whole pixels. The root takes the pixels
// from the layout of the event, so they are right also when the app has not written the layout yet.
function getSnapshot(layout: ResizableRootLayout): ResizableRootLayoutSnapshot {
  const space = measurement.value?.space;
  if (space === undefined) {
    return { ...layout };
  }
  return {
    ...layout,
    ...Object.fromEntries(
      constraints.value.flatMap((panel) => {
        const size = layout[panel.id];
        return panel.fixed && size !== undefined
          ? [[panel.id, `${Math.round((size / 100) * space)}px`]]
          : [];
      }),
    ),
  };
}

function commitLayout(
  layout: ResizableRootLayout,
  reason: ResizableRootCommitEventReason,
  event?: Event,
) {
  const snapshot = getSnapshot(layout);
  emit(
    'layoutCommitted',
    layout,
    // `reset` is a reason of this family only, so `createGenericEventDetails` does not know it.
    reason === 'reset'
      ? { reason, event: event ?? new Event('vase-ui'), snapshot }
      : createGenericEventDetails(reason, event, { snapshot }),
  );
}

function startDragging() {
  if (dragging.value) {
    return false;
  }
  layoutBeforeDrag = shown.value;
  dragging.value = true;
  emit('draggingChange', true);
  return true;
}

function stopDragging() {
  if (dragging.value) {
    layoutBeforeDrag = undefined;
    dragging.value = false;
    emit('draggingChange', false);
  }
}

// Reads the page again. The root does it after the mount, when the root or a handle changes size,
// when the window changes size and a size has `vh` or `vw`, and before a drag, a key or a method. A
// root with no room for its panels, such as a root with `display: none`, keeps the last measurement:
// it then has its pixels when it shows again.
function measure() {
  const rootElement = element.value;
  if (rootElement === null) {
    return undefined;
  }
  const next = readMeasurement(
    rootElement,
    panels.value.map((panel) => ({ id: panel.id.value, element: panel.element.value })),
    props.orientation,
  );
  if (next === undefined) {
    return undefined;
  }
  const previous = measurement.value;
  if (previous === undefined || !isSameMeasurement(previous, next)) {
    measurement.value = next;
  }
  // The first measurement gives each length its percent and each fixed panel its pixels.
  if (previous === undefined) {
    acceptInput();
  }
  return measurement.value;
}

// A panel whose first size is a length has no size before the first measurement, so a method
// cannot change the layout of such a root yet.
function canChange() {
  measure();
  return Object.keys(lengthPanels.value).length === 0;
}

function findPanel(id: string) {
  const index = constraints.value.findIndex((panel) => panel.id === id);
  const panel = constraints.value[index];
  const size = shown.value[id];
  return panel === undefined || size === undefined ? undefined : { panel, index, size };
}

// Gives the panel `index` the size `size` with a move of a handle, and emits the change and the
// commit. A key or a double click gives `handleMove`, and the move obeys `pushPanels`. A method
// gives none: it uses the handle after the panel, or the handle before the last panel, and it
// pushes the panels. A method also moves a disabled panel.
function resizeWithHandle(
  index: number,
  size: number,
  only: number | undefined,
  handleMove: ResizableHandleMove | undefined,
): boolean {
  const unlocked = constraints.value.map((panel, panelIndex) =>
    panelIndex === index ? { ...panel, locked: false } : panel,
  );
  const next = adjustLayoutToSize(
    unlocked,
    shown.value,
    handleMove?.pivot ?? (index < unlocked.length - 1 ? index : index - 1),
    index,
    size,
    { only, push: handleMove === undefined || props.pushPanels },
  );
  if (areLayoutsEqual(next, shown.value)) {
    return false;
  }
  const reason = handleMove?.reason ?? REASONS.imperativeAction;
  const applied = changeLayout(next, createChangeEventDetails(reason, handleMove?.event));
  if (applied) {
    commitLayout(applied, reason, handleMove?.event);
  }
  return true;
}

function collapsePanel(id: string, handleMove?: ResizableHandleMove) {
  if (!canChange()) {
    return;
  }
  const found = findPanel(id);
  if (found?.panel.collapsible && !isCollapsed(found.panel, found.size)) {
    resizeWithHandle(found.index, found.panel.collapsedSize, found.index, handleMove);
  }
}

function expandPanel(id: string, handleMove?: ResizableHandleMove) {
  if (!canChange()) {
    return;
  }
  const found = findPanel(id);
  if (found && isCollapsed(found.panel, found.size)) {
    resizeWithHandle(
      found.index,
      sizesBeforeCollapse.get(id) ?? found.panel.minSize,
      -1,
      handleMove,
    );
  }
}

function resizePanel(id: string, size: number | string) {
  if (!canChange()) {
    return;
  }
  const found = findPanel(id);
  const percent = parseSize(size, getSizeBasis(id));
  if (found && percent !== undefined) {
    resizeWithHandle(found.index, percent, found.index, undefined);
  }
}

// The layout at the start, as the panels show it now: a length has the percent that it has in the
// present panel space, and a fixed panel has the pixels of that layout.
function getFirstLayout(): ResizableRootLayout {
  const { layout, pins: exact } = normalize(firstSnapshot);
  const first = resolveLayout(constraints.value, layout);
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

function resetPanel(id: string, handleMove: ResizableHandleMove) {
  if (!canChange()) {
    return false;
  }
  const found = findPanel(id);
  const first = getFirstLayout()[id];
  return (
    found !== undefined &&
    first !== undefined &&
    resizeWithHandle(found.index, first, undefined, handleMove)
  );
}

function getLayout() {
  return { ...shown.value };
}

function setLayout(snapshot: ResizableRootLayoutSnapshot) {
  if (!canChange()) {
    return;
  }
  const { layout, pins: exact } = normalize(snapshot);
  const resolvedLayout = resolveLayout(constraints.value, layout);
  const current = toRequestedLayout(shown.value, requested.value);
  if (areLayoutsEqual(toRequestedLayout(resolvedLayout, layout), current)) {
    return;
  }
  const applied = changeLayout(
    resolvedLayout,
    createChangeEventDetails(REASONS.imperativeAction),
    layout,
  );
  if (applied) {
    // The pixels of a length are exact, and the percent of the layout has three decimals.
    pins.value = { ...pins.value, ...exact };
    commitLayout(applied, REASONS.imperativeAction);
  }
}

function reset() {
  setLayout(firstSnapshot);
}

const orientation = computed(() => props.orientation);

provide(ResizableRootContext, {
  orientation,
  direction,
  outerList,
  disabled: computed(() => props.disabled),
  step: computed(() => parseSize(props.step, getSizeBasis()) ?? 1),
  largeStep: computed(() => parseSize(props.largeStep, getSizeBasis()) ?? 10),
  dragStep: computed(() =>
    props.dragStep === undefined ? undefined : parseSize(props.dragStep, getSizeBasis()),
  ),
  pushPanels: computed(() => props.pushPanels),
  panels,
  constraints,
  shown,
  lengthPanels,
  measurement,
  registerPanel,
  measure,
  startDragging,
  stopDragging,
  changeLayout,
  commitLayout,
  collapsePanel,
  expandPanel,
  resizePanel,
  resetPanel,
  actions: { orientation, getLayout, setLayout, reset },
});

const { element, elementProps } = useRenderElement('div', props, {
  state,
  props: (attrs) => [
    {
      style: {
        display: 'flex',
        flexDirection: props.orientation === 'horizontal' ? 'row' : 'column',
      },
    },
    attrs,
  ],
});

// The root and each handle change the room of the panels when they change size. The panels do not:
// a transition of `flex-grow` moves a panel and leaves the sum of the panels as it is.
watch(
  [element, items],
  ([rootElement, elements], _previous, onCleanup) => {
    if (rootElement === null || typeof ResizeObserver === 'undefined') {
      return;
    }
    // A panel or a handle that mounted changes the room of the panels.
    measure();
    const panelElements = new Set(panels.value.map((panel) => panel.element.value));
    const observer = new ResizeObserver(() => {
      measure();
    });
    observer.observe(rootElement);
    for (const handle of elements) {
      if (handle !== null && !panelElements.has(handle)) {
        observer.observe(handle);
      }
    }
    onCleanup(() => {
      observer.disconnect();
    });
  },
  { flush: 'post' },
);

watch(
  [usesViewportLengths, element],
  ([uses, rootElement], _previous, onCleanup) => {
    if (uses && rootElement !== null) {
      onCleanup(
        addEventListener(ownerWindow(rootElement), 'resize', () => {
          measure();
        }),
      );
    }
  },
  { flush: 'post' },
);

defineExpose({ element, getLayout, setLayout, reset });
</script>

<template>
  <slot v-if="$slots.render" name="render" :props="elementProps()" :state="state" />
  <component :is="as" v-else v-bind="elementProps()"><slot :state="state" /></component>
</template>
