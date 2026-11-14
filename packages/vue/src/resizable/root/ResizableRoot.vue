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
}

export type ResizableRootChangeEventReason =
  typeof REASONS.drag | typeof REASONS.keyboard | typeof REASONS.none;
export type ResizableRootChangeEventDetails =
  VaseUIChangeEventDetails<ResizableRootChangeEventReason>;

export type ResizableRootCommitEventReason = typeof REASONS.drag | typeof REASONS.keyboard;
export type ResizableRootCommitEventDetails =
  VaseUIGenericEventDetails<ResizableRootCommitEventReason>;
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
import { createChangeEventDetails } from '../../internals/createBaseUIEventDetails';
import { useDirection } from '../../internals/direction-context/DirectionContext';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useRenderElement } from '../../internals/useRenderElement';
import { areConstraintsFeasible, resolveLayout, toRequestedLayout } from '../utils/layout';
import type { PanelConstraints } from '../utils/layout';
import { parseSize } from '../utils/parseSize';
import { ResizableRootContext } from './ResizableRootContext';
import type { ResizablePanelRegistration } from './ResizableRootContext';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<ResizableRootProps>(), {
  as: 'div',
  orientation: 'horizontal',
  disabled: false,
  layout: undefined,
  defaultLayout: undefined,
  step: 1,
  largeStep: 10,
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
   * - `'none'` when a panel mounts that the layout does not name
   */
  layoutChange: [layout: ResizableRootLayout, eventDetails: ResizableRootChangeEventDetails];
  'update:layout': [layout: ResizableRootLayout];
  /**
   * Event handler called when the user ends a change of the layout: at the end of a drag that
   * changed the layout, and after a key that changed it.
   * Does not fire if the layout did not change, or if a listener canceled the change.
   * **Warning**: This is a generic event, not a change event.
   *
   * The `eventDetails.reason` indicates what triggered the commit:
   *
   * - `'drag'` for a drag of a handle
   * - `'keyboard'` for a key on a handle
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

const registered = shallowRef<readonly ResizablePanelRegistration[]>([]);
const panels = computed(() =>
  registered.value
    .filter((panel) => !panel.deactivated.value)
    .toSorted((a, b) => a.index.value - b.index.value),
);
const constraints = computed<PanelConstraints[]>(() =>
  panels.value.map((panel) => ({
    id: panel.id.value,
    minSize: parseSize(panel.minSize()),
    maxSize: parseSize(panel.maxSize()),
    defaultSize: panel.defaultSize === undefined ? undefined : parseSize(panel.defaultSize),
  })),
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

function changeLayout(layout: ResizableRootLayout, details: ResizableRootChangeEventDetails) {
  const next = toRequestedLayout(layout, requested.value);
  emit('layoutChange', next, details);
  if (details.isCanceled) {
    return undefined;
  }
  emit('update:layout', next);
  setRequested(next);
  return next;
}

function commitLayout(layout: ResizableRootLayout, details: ResizableRootCommitEventDetails) {
  emit('layoutCommitted', layout, details);
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

provide(ResizableRootContext, {
  orientation: computed(() => props.orientation),
  direction,
  outerList,
  disabled: computed(() => props.disabled),
  step: computed(() => props.step),
  largeStep: computed(() => props.largeStep),
  panels,
  constraints,
  shown,
  registerPanel,
  getPanelSpace,
  startDragging,
  stopDragging,
  changeLayout,
  commitLayout,
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

defineExpose({ element });
</script>

<template>
  <slot v-if="$slots.render" name="render" :props="elementProps()" :state="state" />
  <component :is="as" v-else v-bind="elementProps()"><slot :state="state" /></component>
</template>
