<script lang="ts">
import type { HTMLAttributes } from 'vue';
import type {
  VaseUIChangeEventDetails,
  VaseUIGenericEventDetails,
} from '../../internals/createVaseUIEventDetails';
import { REASONS } from '../../internals/reasons';
import type { Orientation, VaseUIComponentProps, WithVaseUIEvent } from '../../internals/types';
import type { Layout, LayoutSnapshot } from '../utils/layout';

/**
 * The size of each panel in percent of the panel space, by panel `id`. The sizes sum to 100.
 */
export type ResizableRootLayout = Layout;

/**
 * The size of each panel by panel `id`. A size is a number, or a string of a number with a unit.
 * `'30'` and `'30%'` are percent of the panel space. `'200px'`, `'12em'`, `'12rem'`, `'30vh'` and
 * `'30vw'` are lengths.
 */
export type ResizableRootLayoutSnapshot = LayoutSnapshot;

/**
 * When a drag changes the layout. `'live'`: at each move of the pointer. `'on-release'`: one time,
 * at the release.
 */
export type ResizableRootResizeMode = 'live' | 'on-release';

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
   * percent of the panel space when the root reads it. A fixed panel keeps the pixels. In an entry,
   * `em` is the font size of the panel.
   * The root reads a length when it has a measurement, so the size of a length shows after the
   * mount. The change events give percent.
   * The panels show the layout as far as their constraints allow. The root ignores an entry that is
   * not a size, and a development build shows a warning.
   * `null` is a layout with no entries, as `{}` is, and the root stays controlled.
   * An entry for a panel that is not mounted stays in the layout, and the panel gets its size back
   * when it mounts.
   *
   * To render an uncontrolled root, use the `defaultLayout` prop instead.
   */
  layout?: ResizableRootLayoutSnapshot | null | undefined;
  /**
   * The uncontrolled layout at the start. It takes the same sizes as `layout`, and the root ignores
   * an entry that is not a size in the same way. `null` is a layout with no entries.
   * A panel with no entry takes its `defaultSize`, or an equal share of the space that is left.
   * The `reset()` method and a double click on a handle give back the sizes of this layout: the
   * method for each panel, and the double click for the primary panel of the handle.
   *
   * To render a controlled root, use the `layout` prop instead.
   */
  defaultLayout?: ResizableRootLayoutSnapshot | null | undefined;
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
  /**
   * The least size of the area that takes a press on a handle, in pixels, on the axis of the move.
   * A number is the size for each pointer. With an object, the root uses `coarse` while the main
   * pointer of the device is coarse, such as a finger, and `fine` for another pointer.
   * The size is also the size of an edge and the reach of a crossing.
   * The root reads the pointer after the mount, so the server HTML has the `fine` size.
   * @default { fine: 10, coarse: 24 }
   */
  hitAreaSize?: number | { fine: number; coarse: number } | undefined;
  /**
   * When a drag changes the layout. With `'live'`, each move of the pointer changes the layout.
   * With `'on-release'`, the layout stays as it is during the drag, and the release changes it one
   * time. Each handle and edge that the drag moves then has the CSS variable
   * `--resizable-handle-preview-offset`: the distance to the place that the release gives it.
   * A key, a double click and a method change the layout at once in both modes.
   * @default 'live'
   */
  resizeMode?: ResizableRootResizeMode | undefined;
  /**
   * Whether the user can drag the boundary of two panels that have no handle between them. The
   * root then renders edge nodes that take the press at each such boundary, and it gets
   * `position: relative`. An edge has no key and no ARIA role, so give a boundary a
   * `Resizable.Handle` where you can.
   * @default false
   */
  dragEdges?: boolean | undefined;
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
   * that is left. The layout takes the same sizes as the `layout` prop, and the root ignores an
   * entry that is not a size. `null` is a layout with no entries.
   * The change has the reason `'imperative-action'`. It does nothing when the root has this
   * layout already.
   */
  setLayout: (layout: ResizableRootLayoutSnapshot | null) => void;
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
  inject,
  onMounted,
  onScopeDispose,
  provide,
  shallowReactive,
  shallowRef,
  watch,
} from 'vue';
import type { Component } from 'vue';
import { areArraysEqual } from '../../common/areArraysEqual';
import { useResizeObserver } from '../../common/useResizeObserver';
import { useDomEffect } from '../../utils/popups/useDomEffect';
import { addEventListener } from '../../common/addEventListener';
import { EMPTY_OBJECT } from '../../common/empty';
import { useIsHydrated } from '../../common/hydration';
import { ownerWindow } from '../../common/owner';
import { contains, getTarget } from '../../common/shadowDom';
import { useControlled } from '../../common/useControlled';
import { warn } from '../../common/warn';
import { useCompositeList } from '../../internals/composite/list/useCompositeList';
import {
  createChangeEventDetails,
  createGenericEventDetails,
} from '../../internals/createVaseUIEventDetails';
import { useDirection } from '../../internals/direction-context/DirectionContext';
import type { HTMLProps } from '../../internals/types';
import { useCastBooleanWarning } from '../../internals/useCastBooleanWarning';
import { useKeepAliveState } from '../../internals/useKeepAliveState';
import { useRenderElement } from '../../internals/useRenderElement';
import { useMediaQuery } from '../../unstable-use-media-query';
import { tabbable } from '../../utils/popups/focus/tabbable';
import {
  adjustLayoutToSize,
  applyFixedSizes,
  areConstraintsFeasible,
  areLayoutsEqual,
  isCollapsed,
  resolveLayout,
  takePins,
  toRequestedLayout,
  formatSize,
  isLength,
  isSize,
  isViewportLength,
  normalizeLayout,
  parseSize,
  SIZE_FORMS,
} from '../utils/layout';
import type { PanelConstraints } from '../utils/layout';
import { getMeasurement, isSameMeasurement, readMeasurement } from '../utils/measure';
import type { RootMeasurement } from '../utils/measure';
import ResizableRootChildren from './ResizableRootChildren.vue';
import { ResizableRootContext, ResizableRootEdgesContext } from './ResizableRootContext';
import type {
  ResizableHandleMove,
  EdgeBoundary,
  EdgeBox,
  ResizablePanelRegistration,
  ResizableRegistration,
} from './ResizableRootContext';

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
  hitAreaSize: () => ({ fine: 10, coarse: 24 }),
  resizeMode: 'live',
  dragEdges: false,
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
  /**
   * Event handler called with the new layout after each change that no listener canceled.
   * `v-model:layout` uses it.
   */
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
   *
   * The `eventDetails.snapshot` is the layout with the size of each fixed panel in pixels.
   */
  layoutCommitted: [layout: ResizableRootLayout, eventDetails: ResizableRootCommitEventDetails];
  /**
   * Event handler called when the user starts or ends a drag of a handle.
   */
  draggingChange: [dragging: boolean];
}>();

defineSlots<{
  default(props: { state: ResizableRootState }): unknown;
  render(props: { props: HTMLProps; state: ResizableRootState; children: Component }): unknown;
}>();

const direction = useDirection();
const dragging = shallowRef(false);

const state = computed<ResizableRootState>(() => ({
  orientation: props.orientation,
  disabled: props.disabled,
  dragging: dragging.value,
}));

// The layout that the user or the app asked for: the `layout` prop, or the layout of the last change.
const input = useControlled<ResizableRootLayoutSnapshot>({
  // `undefined` makes the root uncontrolled, so only `null` becomes a layout with no entries. The ref
  // of `useCookie` of Nuxt is `null` after the removal of the cookie.
  controlled: () => (props.layout === null ? EMPTY_OBJECT : props.layout),
  default: () => props.defaultLayout ?? EMPTY_OBJECT,
  name: 'Resizable',
  state: 'layout',
});

// The layout at the start. A later change of `defaultLayout` has no effect.
const firstSnapshot: ResizableRootLayoutSnapshot = props.defaultLayout ?? EMPTY_OBJECT;

const registered = shallowReactive(new Set<ResizableRegistration>());
const parts = computed(() => [...registered].filter((part) => !part.isHeld.value));
const panels = computed(() =>
  parts.value.filter((part) => 'id' in part).sort((a, b) => a.index.value - b.index.value),
);

// What the root read from the page. A server, the first render of a client and a root that has had
// no room for its panels have none.
const measurement = shallowRef<RootMeasurement | undefined>();
// The pixels of each fixed panel. A size change of the root gives each fixed panel its pixels, and
// the other panels share the rest.
const pins = shallowRef<Readonly<Record<string, number>>>(EMPTY_OBJECT);

function measurementFor(id?: string) {
  return measurement.value === undefined ? undefined : getMeasurement(measurement.value, id);
}

// The percent of a `defaultSize` that is a length, as it was at the first measurement after the
// mount of its panel. The panel keeps that percent, so it scales with the root as a panel with a
// default size in percent does. A method that gives the first sizes back uses the length again, so
// it gives the pixels.
const firstDefaultSizes = new WeakMap<ResizablePanelRegistration, number>();

function buildConstraints(useFirstDefaultSizes: boolean): PanelConstraints[] {
  return panels.value.map((panel) => {
    const id = panel.id.value;
    const panelMeasurement = measurementFor(id);
    // A length has no percent before the first measurement. The panel then has the size that it has
    // with no such constraint.
    const toPercent = (size: number | string | undefined) =>
      size === undefined ? undefined : parseSize(size, panelMeasurement);
    return {
      id,
      minSize: toPercent(panel.minSize()) ?? 0,
      maxSize: toPercent(panel.maxSize()) ?? 100,
      collapsible: panel.collapsible(),
      collapsedSize: toPercent(panel.collapsedSize()) ?? 0,
      defaultSize:
        (useFirstDefaultSizes ? firstDefaultSizes.get(panel) : undefined) ??
        toPercent(panel.defaultSize),
      collapseThreshold: toPercent(panel.collapseThreshold()),
      locked: panel.disabled(),
      fixed: panel.rootResizeBehavior() === 'fixed',
      priority: panel.rootResizePriority(),
      snapPoints: panel.snapPoints()?.flatMap((point) => toPercent(point) ?? []),
      snapTolerance: toPercent(panel.snapTolerance()),
    };
  });
}

const constraints = computed(() => buildConstraints(true));

// A visitor can change a layout that the app reads from a cookie or a storage, so the root ignores
// an entry that is not a size. The template of the app gives a size prop, so a size prop that is
// not valid throws.
function normalize(snapshot: ResizableRootLayoutSnapshot) {
  if (process.env.NODE_ENV !== 'production') {
    for (const [id, size] of Object.entries(snapshot)) {
      if (!isSize(size)) {
        warn(
          `The layout gives the panel "${id}" the size ${formatSize(size)}, which is not valid.`,
          'The root ignores this size, so the panel takes its `defaultSize`, or an equal share of the space that is left.',
          SIZE_FORMS,
        );
      }
    }
  }
  const fixedIds = new Set(
    constraints.value.filter((panel) => panel.fixed).map((panel) => panel.id),
  );
  return normalizeLayout(snapshot, fixedIds, measurementFor);
}

// The layout in percent. A length of `input` has no percent before the first measurement, so the
// layout then lacks it.
const requested = shallowRef<ResizableRootLayout>(normalize(input.value).layout);

// The panels whose first size is a length, before the first measurement. A server and the first
// render of a client cannot give such a panel a size in percent.
const lengthPanels = computed<ReadonlyMap<string, string>>(() => {
  if (measurement.value !== undefined) {
    return new Map();
  }
  return new Map(
    panels.value.flatMap((panel) => {
      const id = panel.id.value;
      const entry = Object.hasOwn(input.value, id) ? input.value[id] : undefined;
      const first = isSize(entry) ? entry : panel.defaultSize;
      return typeof first === 'string' && isLength(first) ? [[id, first.trim()] as const] : [];
    }),
  );
});

// The layout of the requested sizes, inside the constraints. A panel that waits for the first
// measurement has no size, and the other panels share the room.
const resolved = computed<ResizableRootLayout>(() => {
  if (lengthPanels.value.size === 0) {
    return resolveLayout(constraints.value, requested.value);
  }
  const layout = resolveLayout(
    constraints.value.filter((panel) => !lengthPanels.value.has(panel.id)),
    requested.value,
  );
  return Object.fromEntries(
    constraints.value.map((panel) => [
      panel.id,
      lengthPanels.value.has(panel.id) ? 0 : (layout[panel.id] ?? 0),
    ]),
  );
});

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

// A length turns into percent when the root reads `input`. The root reads it at the first measurement
// and at each change of it. So a size change of the root does not move a panel that is not fixed.
// A fixed panel takes its pixels again.
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
  () => constraints.value.filter((panel) => panel.fixed && !Object.hasOwn(pins.value, panel.id)),
  (unpinned) => {
    if (unpinned.length && measurement.value) {
      pins.value = { ...pins.value, ...takePins(unpinned, shown.value, measurement.value.space) };
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

const usesViewportLengths = computed(
  () =>
    panels.value.some((panel) => getSizes(panel).some(isViewportLength)) ||
    [props.step, props.largeStep, props.dragStep].some(isViewportLength),
);

if (process.env.NODE_ENV !== 'production') {
  useCastBooleanWarning('Resizable.Root');
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
const { isHeld } = useKeepAliveState();
let knownIds = new Set<string>();

// Each panel and handle gets its place among the others from this list. A server gives the places
// in the order of `setup`. The list calls this function when a panel or a handle comes or goes,
// and after it sorted them. A panel that mounts with no entry in the layout of the consumer gets a
// size, and the others make room for it. The layout then names that panel. A panel that goes keeps
// its entry, so it comes back at its size.
function syncLayoutWithPanels() {
  if (isHeld.value) {
    return;
  }
  const ids = constraints.value.map((panel) => panel.id);
  // A panel that waits for the first measurement has no size yet, so it is not new for the layout.
  const isNew = ids.some(
    (id) => !knownIds.has(id) && !Object.hasOwn(requested.value, id) && !lengthPanels.value.has(id),
  );
  knownIds = new Set(ids);
  if (mounted && isNew) {
    changeLayout(shown.value, createChangeEventDetails(REASONS.none));
  }
}

const list = useCompositeList<{ id?: string }>({
  elementsRef: shallowRef([]),
  onMapChange: syncLayoutWithPanels,
  provide: false,
});

const isHydrated = useIsHydrated();
watch(
  () => isHydrated.value && !isHeld.value,
  () => {
    // A parent mount hook can read lengths before the first resize observation.
    knownIds = new Set(constraints.value.map((panel) => panel.id));
    mounted = true;
    measure();
  },
  { once: true, flush: 'sync' },
);

function registerPart(part: ResizableRegistration) {
  registered.add(part);
  onScopeDispose(() => registered.delete(part));
}

// The size that each panel had before a change collapsed it. `expand()` gives it back.
const sizesBeforeCollapse = new Map<string, number>();
// The layout at the start of the drag that runs. Each move of a drag starts from this layout, so a
// panel that a drag collapses gets the size from the start of the drag, for any number of moves.
let layoutBeforeDrag: ResizableRootLayout | undefined;

// A watcher, and not the change path, sees each collapse: also a collapse that the `layout` prop of
// the consumer gives. It is `sync`, so an `expand()` right after a `collapse()` finds the size.
watch(
  () => (isHydrated.value ? shown.value : undefined),
  (after, before) => {
    if (after === undefined || before === undefined || isHeld.value) {
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
  input.value = next;
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

// The layout that the release of the drag gives, while a drag in the mode `'on-release'` runs.
const pendingLayout = shallowRef<ResizableRootLayout | undefined>();

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
    pendingLayout.value = undefined;
    dragging.value = false;
    emit('draggingChange', false);
  }
}

function setPendingLayout(layout: ResizableRootLayout) {
  pendingLayout.value = layout;
}

// A root with no room for its panels, such as a root with `display: none`, keeps its last
// measurement. It then has its pixels again when it shows.
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
  for (const panel of panels.value) {
    const size = panel.defaultSize;
    if (size !== undefined && isLength(size) && !firstDefaultSizes.has(panel)) {
      firstDefaultSizes.set(panel, parseSize(size, getMeasurement(next, panel.id.value)) ?? 0);
    }
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

// A panel whose first size is a length has no size before the first measurement. A method cannot
// change the layout of such a root until then.
function canChange() {
  measure();
  return lengthPanels.value.size === 0;
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
  const percent = parseSize(size, measurementFor(id));
  if (found && percent !== undefined) {
    resizeWithHandle(found.index, percent, found.index, undefined);
  }
}

// The layout at the start, as the panels show it now. A length has the percent that it has in the
// present panel space. A fixed panel has the pixels of that layout.
function getFirstLayout(): ResizableRootLayout {
  const { layout, pins: exact } = normalize(firstSnapshot);
  const first = resolveLayout(buildConstraints(false), layout);
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

function setLayout(layout: ResizableRootLayoutSnapshot | null) {
  if (!canChange()) {
    return;
  }
  const { layout: requestedLayout, pins: exact } = normalize(layout ?? EMPTY_OBJECT);
  const resolvedLayout = resolveLayout(buildConstraints(false), requestedLayout);
  const current = toRequestedLayout(shown.value, requested.value);
  if (areLayoutsEqual(toRequestedLayout(resolvedLayout, requestedLayout), current)) {
    return;
  }
  const applied = changeLayout(
    resolvedLayout,
    createChangeEventDetails(REASONS.imperativeAction),
    requestedLayout,
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

const rootOrientation = computed(() => props.orientation);

// The first client render must equal the server HTML, so the composable gives `false` until the
// mount, and the server HTML has the `fine` size. The call comes also for a number, so a change of
// the prop to an object needs no new call in `setup`.
const isCoarse = useMediaQuery('(pointer: coarse)', {});
const pointerHitAreaSize = computed(() => {
  const size = props.hitAreaSize;
  return typeof size === 'number' ? size : isCoarse.value ? size.coarse : size.fine;
});

// The nearest root around this root. `provide` below does not change what `inject` gives.
const outerRoot = inject(ResizableRootContext, null);

// The first control of the first panel in `items` that shows and has a control.
function findPanelControl(items: readonly Element[]) {
  for (const item of items) {
    const panel = panels.value.find((entry) => entry.element.value === item);
    const size = panel === undefined ? undefined : shown.value[panel.id.value];
    const control = size !== undefined && size > 0 ? tabbable(item)[0] : undefined;
    if (control !== undefined) {
      return control;
    }
  }
  return undefined;
}

// F6 moves the focus to the next panel, and Shift+F6 to the previous one, as the window splitter
// pattern describes. A root in a panel of another root gives the key to that root at its last
// panel. A root that is not in a panel of another root goes on from its other end: the root around
// it does not move the focus for a key from outside its panels, such as from a root that a
// `Teleport` moves out.
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
  const items = [...list.map.value.keys()];
  const target = getTarget(event) as Element | null;
  const from = items.findIndex((item) => contains(item, target));
  if (from < 0) {
    return;
  }
  const forward = !event.shiftKey;
  const next = findPanelControl(forward ? items.slice(from + 1) : items.slice(0, from).reverse());
  const isNested =
    outerRoot?.panels.value.some((panel) => contains(panel.element.value, element.value)) ?? false;
  const control =
    next ??
    (isNested
      ? undefined
      : findPanelControl(forward ? items.slice(0, from + 1) : items.slice(from).reverse()));
  if (control !== undefined) {
    control.focus();
    event.preventDefault();
  }
}

provide(ResizableRootContext, {
  orientation: rootOrientation,
  direction,
  list,
  disabled: computed(() => props.disabled),
  step: computed(() => parseSize(props.step, measurementFor()) ?? 1),
  largeStep: computed(() => parseSize(props.largeStep, measurementFor()) ?? 10),
  dragStep: computed(() =>
    props.dragStep === undefined ? undefined : parseSize(props.dragStep, measurementFor()),
  ),
  pushPanels: computed(() => props.pushPanels),
  hitAreaSize: pointerHitAreaSize,
  resizeMode: computed(() => props.resizeMode),
  pendingLayout,
  panels,
  constraints,
  shown,
  lengthPanels,
  measurement,
  registerPart,
  measure,
  startDragging,
  stopDragging,
  setPendingLayout,
  changeLayout,
  commitLayout,
  collapsePanel,
  expandPanel,
  resizePanel,
  resetPanel,
  actions: { orientation: rootOrientation, getLayout, setLayout, reset },
});

const { element, elementProps, setRef, usesRenderSlot } = useRenderElement('div', props, {
  state,
  children: true,
  // The listener of the consumer runs first, so `event.preventVaseUIHandler()` stops F6.
  props: (attrs) => [
    {
      style: {
        display: 'flex',
        flexDirection: props.orientation === 'horizontal' ? 'row' : 'column',
        // The root is the containing block of the edge nodes, and the offset parent of the panels.
        ...(props.dragEdges ? { position: 'relative' } : undefined),
      },
      onKeydown,
    },
    attrs,
  ],
});

const boundaries = computed(() => {
  if (!props.dragEdges || props.disabled || isHeld.value) return [];
  const ordered = panels.value;
  const first = ordered.findIndex((panel) => !panel.disabled());
  const last = ordered.findLastIndex((panel) => !panel.disabled());
  // A detached root can have gaps in its setup indexes after a handle leaves.
  const handles = parts.value.filter((part) => !('id' in part)).map((part) => part.index.value);
  return ordered.flatMap((before, index) => {
    const after = ordered[index + 1];
    return index >= first &&
      index < last &&
      after &&
      !handles.some((handle) => handle > before.index.value && handle < after.index.value)
      ? [{ before, after }]
      : [];
  });
});

function edgeAreas(before: HTMLElement, after: HTMLElement): EdgeBox[] {
  const horizontal = props.orientation === 'horizontal';
  const offset = horizontal ? 'offsetLeft' : 'offsetTop';
  const length = horizontal ? 'offsetWidth' : 'offsetHeight';
  const [first, second] = before[offset] <= after[offset] ? [before, after] : [after, before];
  const end = first[offset] + first[length];
  const start = second[offset];
  const gap = Math.max(start - end, 0);
  const size = pointerHitAreaSize.value;
  // A wide gap can contain another control. Keep its center free for presses.
  const areas: [center: number, width: number][] =
    before.nextElementSibling === after || gap <= size
      ? [[(end + start) / 2, Math.max(gap, size)]]
      : [
          [end, size],
          [start, size],
        ];
  return areas
    .filter(([, width]) => width > 0)
    .map(([center, width]) =>
      horizontal
        ? { left: center - width / 2, top: before.offsetTop, width, height: before.offsetHeight }
        : {
            left: before.offsetLeft,
            top: center - width / 2,
            width: before.offsetWidth,
            height: width,
          },
    );
}

const edges = shallowRef<readonly EdgeBoundary[]>([]);
function sameEdge(a: EdgeBoundary, b: EdgeBoundary) {
  return (
    a.before === b.before &&
    areArraysEqual(
      a.areas,
      b.areas,
      (first, second) =>
        first.left === second.left &&
        first.top === second.top &&
        first.width === second.width &&
        first.height === second.height,
    )
  );
}

function updateEdges() {
  const next: EdgeBoundary[] = [];
  if (measurement.value) {
    for (const { before, after } of boundaries.value) {
      const first = before.element.value;
      const second = after.element.value;
      if (!first || !second) continue;
      const areas = edgeAreas(first, second);
      if (areas.length) next.push({ before, areas });
    }
  }
  if (!areArraysEqual(edges.value, next, sameEdge)) edges.value = next;
}

// A panel transition moves its boundary between Vue updates.
useResizeObserver(
  () => (boundaries.value.length ? panels.value.map((panel) => panel.element.value) : []),
  updateEdges,
);
watch([boundaries, rootOrientation, pointerHitAreaSize, shown, measurement], updateEdges, {
  flush: 'post',
});
provide(ResizableRootEdgesContext, { edges });

// The root and the handles determine how much space the panels share.
useResizeObserver(
  () => [
    element.value,
    ...[...list.map.value].filter(([, item]) => item.id === undefined).map(([node]) => node),
  ],
  measure,
);

onMounted(() => {
  watch(
    [element, list.map, rootOrientation],
    () => {
      if (!isHeld.value) measure();
    },
    { flush: 'post' },
  );
});

useDomEffect(
  [usesViewportLengths, element],
  () =>
    usesViewportLengths.value && element.value
      ? addEventListener(ownerWindow(element.value), 'resize', measure)
      : undefined,
  isHeld,
);

defineExpose({ element, getLayout, setLayout, reset });
</script>

<!-- prettier-ignore -->
<template>
  <slot v-if="usesRenderSlot()" name="render" :props="elementProps()" :state="state" :children="ResizableRootChildren" />
  <component :is="as" v-else v-bind="elementProps()" :ref="setRef">
    <ResizableRootChildren><slot :state="state" /></ResizableRootChildren>
  </component>
</template>
