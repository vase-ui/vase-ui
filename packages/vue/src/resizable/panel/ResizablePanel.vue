<script lang="ts">
import type { HTMLAttributes } from 'vue';
import type { Orientation, VaseUIComponentProps, WithVaseUIEvent } from '../../internals/types';

export interface ResizablePanelState {
  /**
   * The orientation of the panels.
   */
  orientation: Orientation;
  /**
   * The size of the panel in percent of the panel space.
   */
  size: number;
  /**
   * Whether the panel is collapsed: it is collapsible, and it has its collapsed size.
   */
  collapsed: boolean;
  /**
   * Whether a move of a handle leaves the size of the panel as it is.
   */
  disabled: boolean;
}

export interface ResizablePanelSize {
  /**
   * The size in percent of the panel space.
   */
  percent: number;
  /**
   * The size in pixels, with three decimals. A pixel is a layout pixel: a scale transform around
   * the root does not change it. It is 0 while the root has no measurement.
   */
  pixels: number;
}

export interface ResizablePanelProps
  extends
    VaseUIComponentProps<ResizablePanelState>,
    /* @vue-ignore */ Omit<WithVaseUIEvent<HTMLAttributes>, 'id'> {
  /**
   * The id of the panel element, and the key of the panel in the layout.
   * The default is a generated id. Give an id of your own to save the layout and to read it again.
   */
  id?: string | undefined;
  /**
   * The size of the panel at the start.
   * A size is a number, or a string of a number with a unit. A number, and a string with no unit or
   * with `%`, are percent of the panel space. A length is `px`, `em`, `rem`, `vh` or `vw`. `em` is
   * the font size of the panel. `rem` is the font size of the root element of the document.
   * The panels that have no size share the space that is left in equal parts.
   * A length gives the size at the first measurement after the mount. The panel then has that size in
   * percent, so it scales with the root, unless it is fixed. `reset()` and a double click on a handle
   * give the length back.
   * A later change of the prop has no effect. To change the size, change the layout of the root.
   */
  defaultSize?: number | string | undefined;
  /**
   * The least size of the panel. It takes the same sizes as `defaultSize`.
   * A length applies from the first measurement, which is after the mount.
   * @default 0
   */
  minSize?: number | string | undefined;
  /**
   * The greatest size of the panel. It takes the same sizes as `defaultSize`.
   * A length applies from the first measurement, which is after the mount.
   * @default 100
   */
  maxSize?: number | string | undefined;
  /**
   * Whether the panel can collapse to its `collapsedSize`.
   * A drag collapses the panel when it goes below `minSize` by more than `collapseThreshold`.
   * A drag expands a collapsed panel when it goes above `collapsedSize` by more than
   * `collapseThreshold`.
   * A key on a handle and the methods of the panel collapse and expand it at once.
   * The panel needs a `minSize` that is greater than its `collapsedSize`.
   * @default false
   */
  collapsible?: boolean | undefined;
  /**
   * The size of the panel when it is collapsed. It takes the same sizes as `defaultSize`.
   * @default 0
   */
  collapsedSize?: number | string | undefined;
  /**
   * The distance that a drag must pass below `minSize` to collapse the panel, and above
   * `collapsedSize` to expand it. It takes the same sizes as `defaultSize`.
   * The default is half of the distance between `minSize` and `collapsedSize`.
   * A threshold that is greater than that distance acts as that distance.
   */
  collapseThreshold?: number | string | undefined;
  /**
   * Whether a move of a handle leaves the size of the panel as it is.
   * A move of a handle then goes through the panel to the next panel.
   * The layout of the root and the methods of the panel still change the size.
   * @default false
   */
  disabled?: boolean | undefined;
  /**
   * What the panel does when the root changes size.
   * A `'fixed'` panel keeps the pixels that it has, and the other panels share the rest in the ratio
   * that they have. A `'proportional'` panel keeps its size in percent.
   * A drag, a key, a method and the layout of the app give a fixed panel new pixels. The change of
   * the root gives no layout event.
   * @default 'proportional'
   */
  rootResizeBehavior?: 'proportional' | 'fixed' | undefined;
  /**
   * The order in which fixed panels give way when the other panels cannot take a size change of the
   * root. The panel with the greater number gives way first, and panels with the same number give way
   * in the order of the document.
   * @default 0
   */
  rootResizePriority?: number | undefined;
  /**
   * The sizes that a drag snaps to. A drag that comes within `snapTolerance` of one of them gives the
   * panel that size. A snap point takes the same sizes as `defaultSize`. A snap point that is less than
   * `minSize` or greater than `maxSize` is not used. A key and a method do not snap.
   */
  snapPoints?: readonly (number | string)[] | undefined;
  /**
   * The distance from a snap point inside which a drag snaps to that point. It takes the same sizes
   * as `defaultSize`.
   * @default '10px'
   */
  snapTolerance?: number | string | undefined;
}

export interface ResizablePanelActions {
  /**
   * Collapses the panel to its `collapsedSize`. The panel after it takes its space, or the panel
   * before it for the last panel.
   * No other panel collapses for it. It does nothing when the panel is not collapsible or is
   * collapsed.
   */
  collapse: () => void;
  /**
   * Gives a collapsed panel the size that it had before it collapsed, or its `minSize` when it has
   * no such size. After a drag, that size is the size at the start of the drag. The panel gets less
   * when the other panels cannot give the room without a collapse, and it stays collapsed when they
   * cannot give its `minSize`.
   * No other panel collapses for it. It does nothing when the panel is not collapsed.
   */
  expand: () => void;
  /**
   * Gives the panel a size, as far as the constraints of the panels allow. A collapsible panel
   * collapses when the size is less than its `minSize`. No other panel collapses for it.
   * The size is a number, or a string of a number with a unit, as `defaultSize` takes it. It does
   * nothing for a length before the first measurement.
   */
  resize: (size: number | string) => void;
  /**
   * Whether the panel is collapsed.
   */
  isCollapsed: () => boolean;
  /**
   * Reads the page, and gives the size of the panel in percent and in pixels.
   */
  getSize: () => ResizablePanelSize;
}
</script>

<script setup lang="ts">
import { computed, onActivated, onDeactivated, provide, shallowRef, watch } from 'vue';
import type { InjectionKey } from 'vue';
import { useIsHydrating } from '../../common/hydration';
import { CompositeListContext } from '../../internals/composite/list/CompositeListContext';
import type { CompositeListContextValue } from '../../internals/composite/list/CompositeListContext';
import { useCompositeListItem } from '../../internals/composite/list/useCompositeListItem';
import { useDeferredServerRender } from '../../internals/labelable-provider';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useVaseUiId } from '../../internals/useBaseUiId';
import { useRenderElement } from '../../internals/useRenderElement';
import { useValueChanged } from '../../internals/useValueChanged';
import { useResizableRootContext } from '../root/ResizableRootContext';
import { isCollapsed } from '../utils/layout';
import { getPanelSize } from '../utils/measure';
import { ResizablePanelContext } from './ResizablePanelContext';
import * as ResizablePanelCssVariables from './ResizablePanelCssVariables';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<ResizablePanelProps>(), {
  as: 'div',
  minSize: 0,
  maxSize: 100,
  collapsible: false,
  collapsedSize: 0,
  disabled: false,
  rootResizeBehavior: 'proportional',
  rootResizePriority: 0,
  snapPoints: undefined,
  snapTolerance: '10px',
});

const emit = defineEmits<{
  /**
   * Event handler called when the panel collapses or expands: when `collapsed` changes.
   * It is called after the DOM update, and not at the mount.
   */
  collapsedChange: [collapsed: boolean];
  /**
   * Event handler called after the DOM update when the size of the panel changes in percent or in
   * pixels. The first call comes after the first measurement. A size change of the root changes the
   * pixels, so it also calls the handler.
   * Receives the new size and the size at the last call. At the first call, that size is `undefined`.
   * It is not called on a server, and not before the root first has room for its panels.
   */
  resize: [size: ResizablePanelSize, previousSize: ResizablePanelSize | undefined];
}>();

defineSlots<{
  default(props: { state: ResizablePanelState }): unknown;
  render: ComponentRenderFn<HTMLProps, ResizablePanelState>;
}>();

const root = useResizableRootContext();

// The style of a panel depends on the panels beside it. A server renders the panel after the
// `setup` of the panels that follow it, so the server HTML has the layout of all the panels.
useDeferredServerRender();

const hydrating = useIsHydrating();
const id = useVaseUiId(() => props.id);
// The size at the start: a later change of the prop has no effect.
const defaultSize = props.defaultSize;
// The list publishes its map again when the id changes, so the root sees a panel with a new id.
const { ref: listItemRef, index } = useCompositeListItem({
  metadata: computed(() => ({ id: id.value })),
});

// A panel whose first size is a length has that length until the first measurement. The panel
// cannot have a size in percent before: the room of the panels is not known. It can shrink, so it
// does not overflow a root that is narrower than the length.
const length = computed(() => root.lengthPanels.value.get(id.value));

// A panel that `KeepAlive` holds is not in the layout. It keeps its last size and its last
// `collapsed` state until it shows again.
const size = computed<number>(
  (previous) =>
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- The panel registers in `setup`, so the layout of the first computation has an entry for its id.
    root.shown.value[id.value] ?? previous!,
);
const collapsed = computed<boolean>((previous) => {
  const constraints = root.constraints.value.find((panel) => panel.id === id.value);
  // A panel that waits for its first measurement has no size, and it is not collapsed.
  if (length.value !== undefined) {
    return false;
  }
  return constraints === undefined ? (previous ?? false) : isCollapsed(constraints, size.value);
});

const state = computed<ResizablePanelState>(() => ({
  orientation: root.orientation.value,
  size: size.value,
  collapsed: collapsed.value,
  disabled: props.disabled,
}));

// The panels beside this panel register in `setup` too, so the layout is known only when they all
// have registered. The value is `undefined` until the mount, so the state at the mount has no
// event.
useValueChanged(
  () => (hydrating.value ? undefined : collapsed.value),
  (previous) => {
    if (previous !== undefined) {
      emit('collapsedChange', collapsed.value);
    }
  },
);

const { element, elementProps } = useRenderElement('div', props, {
  state,
  ref: [listItemRef],
  props: (attrs) => [
    {
      id: id.value,
      // While the page hydrates, the first render of this panel knows only the panels that
      // registered before it, so its size can differ from the size in the server HTML.
      'data-allow-mismatch': hydrating.value ? 'style' : undefined,
      style: {
        flex: length.value === undefined ? `${size.value} 1 0px` : `0 1 ${length.value}`,
        [root.orientation.value === 'horizontal' ? 'minWidth' : 'minHeight']: 0,
        ...(length.value === undefined
          ? { [ResizablePanelCssVariables.resizablePanelSize]: String(size.value) }
          : undefined),
      },
    },
    attrs,
  ],
  stateAttributesMapping: { size: () => null },
});

// `KeepAlive` takes the panel out of the document. The root then gives its space to the other
// panels, and the handles beside it do not name it.
const deactivated = shallowRef(false);
onDeactivated(() => {
  deactivated.value = true;
});
onActivated(() => {
  deactivated.value = false;
});

root.registerPanel({
  id,
  index,
  minSize: () => props.minSize,
  maxSize: () => props.maxSize,
  defaultSize,
  collapsible: () => props.collapsible,
  collapsedSize: () => props.collapsedSize,
  collapseThreshold: () => props.collapseThreshold,
  disabled: () => props.disabled,
  rootResizeBehavior: () => props.rootResizeBehavior,
  rootResizePriority: () => props.rootResizePriority,
  snapPoints: () => props.snapPoints,
  snapTolerance: () => props.snapTolerance,
  element,
  deactivated,
});

// The watcher reads the size only after the mount. A size that is not valid then fails in the
// render, and not in the watcher.
let lastSize: ResizablePanelSize | undefined;
watch(
  () =>
    hydrating.value
      ? undefined
      : ([size.value, root.measurement.value?.space, deactivated.value] as const),
  (current) => {
    const [percent, space, isDeactivated] = current ?? [];
    if (percent === undefined || space === undefined || isDeactivated === true) {
      return;
    }
    const next = getPanelSize(percent, space);
    if (next.percent === lastSize?.percent && next.pixels === lastSize.pixels) {
      return;
    }
    const previous = lastSize;
    lastSize = next;
    emit('resize', next, previous);
  },
  { flush: 'post' },
);

const actions: ResizablePanelActions = {
  collapse: () => {
    root.collapsePanel(id.value);
  },
  expand: () => {
    root.expandPanel(id.value);
  },
  resize: (wanted) => {
    root.resizePanel(id.value, wanted);
  },
  isCollapsed: () => collapsed.value,
  getSize: () => {
    root.measure();
    return getPanelSize(size.value, root.measurement.value?.space);
  },
};

provide(ResizablePanelContext, { id, state, ...actions });

// The content of the panel gets the composite list around the root, so that an item in the panel,
// such as a button of a toolbar around the root, joins that list. The key also takes `undefined`:
// with no list around the root, an item in the panel has no list.
const listKey: InjectionKey<CompositeListContextValue<any> | undefined> = CompositeListContext;
provide(listKey, root.outerList);

defineExpose({ element, ...actions });
</script>

<template>
  <slot v-if="$slots.render" name="render" :props="elementProps()" :state="state" />
  <component :is="as" v-else v-bind="elementProps()"><slot :state="state" /></component>
</template>
