<script lang="ts">
import type { HTMLAttributes } from 'vue';
import type {
  VaseUIChangeEventDetails,
  VaseUIGenericEventDetails,
} from '../../internals/createBaseUIEventDetails';
import { REASONS } from '../../internals/reasons';
import type { Orientation, VaseUIComponentProps, WithVaseUIEvent } from '../../internals/types';
import type { Layout } from '../utils/layout';

/**
 * The size of each panel in percent of the panel space, by panel `id`. The sizes sum to 100.
 */
export type ResizableRootLayout = Layout;

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
   * The controlled layout: the size of each panel in percent of the panel space, by panel `id`.
   * The panels show the layout as far as their constraints allow.
   * An entry for a panel that is not mounted stays in the layout, and the panel gets its size back
   * when it mounts.
   *
   * To render an uncontrolled root, use the `defaultLayout` prop instead.
   */
  layout?: ResizableRootLayout | undefined;
  /**
   * The uncontrolled layout at the start.
   * A panel with no entry takes its `defaultSize`, or an equal share of the space that is left.
   * The `reset()` method and a double click on a handle give back the sizes of this layout: the
   * method for each panel, and the double click for the primary panel of the handle.
   *
   * To render a controlled root, use the `layout` prop instead.
   */
  defaultLayout?: ResizableRootLayout | undefined;
  /**
   * The size of the move of an arrow key, in percent of the panel space.
   * @default 1
   */
  step?: number | undefined;
  /**
   * The size of the move of an arrow key with Shift, and of Page Up and Page Down, in percent of the
   * panel space.
   * @default 10
   */
  largeStep?: number | undefined;
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
export type ResizableRootCommitEventDetails =
  VaseUIGenericEventDetails<ResizableRootCommitEventReason>;

export interface ResizableRootActions {
  /**
   * Gives a copy of the layout that the panels show: the size of each panel that is mounted, in
   * percent of the panel space.
   */
  getLayout: () => ResizableRootLayout;
  /**
   * Gives each panel the size that the layout has for it, as far as the constraints of the panels
   * allow. A panel that the layout lacks takes its `defaultSize`, or an equal share of the space
   * that is left.
   * The change has the reason `'imperative-action'`. It does nothing when the root has this
   * layout already.
   */
  setLayout: (layout: ResizableRootLayout) => void;
  /**
   * Gives the panels the layout that they had at the start: the `defaultLayout` of the root.
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
import { EMPTY_OBJECT } from '../../common/empty';
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
  areConstraintsFeasible,
  areLayoutsEqual,
  isCollapsed,
  resolveLayout,
  toRequestedLayout,
} from '../utils/layout';
import type { PanelConstraints } from '../utils/layout';
import { parseSize } from '../utils/parseSize';
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

const [requested, setRequested] = useControlled<ResizableRootLayout>({
  controlled: () => props.layout,
  default: () => props.defaultLayout ?? EMPTY_OBJECT,
  name: 'Resizable',
  state: 'layout',
});

// The layout at the start. A later change of `defaultLayout` has no effect.
const firstRequested: ResizableRootLayout = props.defaultLayout ?? EMPTY_OBJECT;

const registered = shallowRef<readonly ResizablePanelRegistration[]>([]);
const panels = computed(() =>
  registered.value
    .filter((panel) => !panel.deactivated.value)
    .toSorted((a, b) => a.index.value - b.index.value),
);
const constraints = computed<PanelConstraints[]>(() =>
  panels.value.map((panel) => {
    const collapseThreshold = panel.collapseThreshold();
    return {
      id: panel.id.value,
      minSize: parseSize(panel.minSize()),
      maxSize: parseSize(panel.maxSize()),
      collapsible: panel.collapsible(),
      collapsedSize: parseSize(panel.collapsedSize()),
      defaultSize: panel.defaultSize === undefined ? undefined : parseSize(panel.defaultSize),
      collapseThreshold: collapseThreshold === undefined ? undefined : parseSize(collapseThreshold),
      locked: panel.disabled(),
    };
  }),
);
const shown = computed(() => resolveLayout(constraints.value, requested.value));

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
      if (!areConstraintsFeasible(current)) {
        warn(
          'The sizes of the panels cannot sum to 100.',
          'The minimum and maximum sizes of the panels leave no layout that fills the root.',
          'Raise a `maxSize` or lower a `minSize`.',
        );
      }
      const stuck = current.find(
        (panel) => panel.collapsible && panel.minSize <= panel.collapsedSize,
      );
      if (stuck) {
        warn(
          `The panel "${stuck.id}" is collapsible, and its \`minSize\` is not greater than its \`collapsedSize\`.`,
          'A collapsible panel collapses when it goes below its `minSize`, so this panel cannot collapse.',
          'Give the panel a `minSize` that is greater than its `collapsedSize`.',
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
  const isNew = ids.some((id) => !knownIds.has(id) && !Object.hasOwn(requested.value, id));
  knownIds = new Set(ids);
  if (mounted && isNew) {
    changeLayout(shown.value, createChangeEventDetails(REASONS.none));
  }
}

const outerList = useCompositeListContext();
useCompositeList({ elementsRef: shallowRef([]), onMapChange: syncLayoutWithPanels });

onMounted(() => {
  mounted = true;
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

function rememberSizesBeforeCollapse(before: ResizableRootLayout, after: ResizableRootLayout) {
  for (const panel of constraints.value) {
    const sizeBefore = before[panel.id];
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
}

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
  rememberSizesBeforeCollapse(shown.value, layout);
  emit('update:layout', next);
  setRequested(next);
  return next;
}

function commitLayout(layout: ResizableRootLayout, details: ResizableRootCommitEventDetails) {
  emit('layoutCommitted', layout, details);
}

function createCommitDetails(
  reason: ResizableRootCommitEventReason,
  event?: Event,
): ResizableRootCommitEventDetails {
  // `reset` is a reason of this family only, so `createGenericEventDetails` does not know it.
  return reason === 'reset'
    ? { reason, event: event ?? new Event('vase-ui') }
    : createGenericEventDetails(reason, event);
}

function startDragging() {
  if (dragging.value) {
    return false;
  }
  dragging.value = true;
  emit('draggingChange', true);
  return true;
}

function stopDragging() {
  if (dragging.value) {
    dragging.value = false;
    emit('draggingChange', false);
  }
}

// The panel space is the room that the panels share: the sizes of their content boxes. The handles,
// the gaps and the other elements of the root are not in it, and a panel adds its own padding and
// border to its size.
function getPanelSpace() {
  const horizontal = props.orientation === 'horizontal';
  let space = 0;
  for (const { element } of panels.value) {
    const panel = element.value;
    if (panel) {
      const rect = panel.getBoundingClientRect();
      const style = ownerWindow(panel).getComputedStyle(panel);
      const edges = horizontal
        ? [style.paddingLeft, style.paddingRight, style.borderLeftWidth, style.borderRightWidth]
        : [style.paddingTop, style.paddingBottom, style.borderTopWidth, style.borderBottomWidth];
      const size = horizontal ? rect.width : rect.height;
      const layoutSize = horizontal ? panel.offsetWidth : panel.offsetHeight;
      // The rectangle has the pixels of the screen, and the padding and the border have layout
      // pixels. A scale transform around the root makes the two differ.
      const scale = layoutSize > 0 ? size / layoutSize : 1;
      space += Math.max(
        size - edges.reduce((total, edge) => total + Number.parseFloat(edge), 0) * scale,
        0,
      );
    }
  }
  return space;
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
    commitLayout(applied, createCommitDetails(reason, handleMove?.event));
  }
  return true;
}

function collapsePanel(id: string, handleMove?: ResizableHandleMove) {
  const found = findPanel(id);
  if (found?.panel.collapsible && !isCollapsed(found.panel, found.size)) {
    resizeWithHandle(found.index, found.panel.collapsedSize, found.index, handleMove);
  }
}

function expandPanel(id: string, handleMove?: ResizableHandleMove) {
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
  const found = findPanel(id);
  if (found) {
    resizeWithHandle(found.index, parseSize(size), found.index, undefined);
  }
}

function resetPanel(id: string, handleMove: ResizableHandleMove) {
  const found = findPanel(id);
  const first = resolveLayout(constraints.value, firstRequested)[id];
  return (
    found !== undefined &&
    first !== undefined &&
    resizeWithHandle(found.index, first, undefined, handleMove)
  );
}

function getLayout() {
  return { ...shown.value };
}

function setLayout(layout: ResizableRootLayout) {
  const resolved = resolveLayout(constraints.value, layout);
  const current = toRequestedLayout(shown.value, requested.value);
  if (areLayoutsEqual(toRequestedLayout(resolved, layout), current)) {
    return;
  }
  const applied = changeLayout(
    resolved,
    createChangeEventDetails(REASONS.imperativeAction),
    layout,
  );
  if (applied) {
    commitLayout(applied, createGenericEventDetails(REASONS.imperativeAction));
  }
}

function reset() {
  setLayout(firstRequested);
}

const orientation = computed(() => props.orientation);

provide(ResizableRootContext, {
  orientation,
  direction,
  outerList,
  disabled: computed(() => props.disabled),
  step: computed(() => props.step),
  largeStep: computed(() => props.largeStep),
  pushPanels: computed(() => props.pushPanels),
  panels,
  constraints,
  shown,
  registerPanel,
  getPanelSpace,
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

defineExpose({ element, getLayout, setLayout, reset });
</script>

<template>
  <slot v-if="$slots.render" name="render" :props="elementProps()" :state="state" />
  <component :is="as" v-else v-bind="elementProps()"><slot :state="state" /></component>
</template>
