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
   * The size of the panel at the start, in percent of the panel space.
   * A size is a number, or a string of a number with an optional `%`.
   * The panels that have no size share the space that is left in equal parts.
   * A later change of the prop has no effect. To change the size, change the layout of the root.
   */
  defaultSize?: number | string | undefined;
  /**
   * The least size of the panel, in percent of the panel space.
   * @default 0
   */
  minSize?: number | string | undefined;
  /**
   * The greatest size of the panel, in percent of the panel space.
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
   * The size of the panel when it is collapsed, in percent of the panel space.
   * A size is a number, or a string of a number with an optional `%`.
   * @default 0
   */
  collapsedSize?: number | string | undefined;
  /**
   * The distance that a drag must pass below `minSize` to collapse the panel, and above
   * `collapsedSize` to expand it, in percent of the panel space.
   * A size is a number, or a string of a number with an optional `%`.
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
   * The size is a number, or a string of a number with an optional `%`.
   */
  resize: (size: number | string) => void;
  /**
   * Whether the panel is collapsed.
   */
  isCollapsed: () => boolean;
}
</script>

<script setup lang="ts">
import { computed, onActivated, onDeactivated, provide, shallowRef } from 'vue';
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
});

const emit = defineEmits<{
  /**
   * Event handler called when the panel collapses or expands: when `collapsed` changes.
   * It is called after the DOM update, and not at the mount.
   */
  collapsedChange: [collapsed: boolean];
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

// A panel that `KeepAlive` holds is not in the layout. It keeps its last size and its last
// `collapsed` state until it shows again.
const size = computed<number>(
  (previous) =>
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- The panel registers in `setup`, so the layout of the first computation has an entry for its id.
    root.shown.value[id.value] ?? previous!,
);
const collapsed = computed<boolean>((previous) => {
  const constraints = root.constraints.value.find((panel) => panel.id === id.value);
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
        flex: `${size.value} 1 0px`,
        [root.orientation.value === 'horizontal' ? 'minWidth' : 'minHeight']: 0,
        [ResizablePanelCssVariables.resizablePanelSize]: String(size.value),
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
  element,
  deactivated,
});

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
