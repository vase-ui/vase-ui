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
}
</script>

<script setup lang="ts">
import { computed, onActivated, onDeactivated, shallowRef } from 'vue';
import { useIsHydrating } from '../../common/hydration';
import { useCompositeListItem } from '../../internals/composite/list/useCompositeListItem';
import { useDeferredServerRender } from '../../internals/labelable-provider';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useVaseUiId } from '../../internals/useBaseUiId';
import { useRenderElement } from '../../internals/useRenderElement';
import { useResizableRootContext } from '../root/ResizableRootContext';
import * as ResizablePanelCssVariables from './ResizablePanelCssVariables';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<ResizablePanelProps>(), {
  as: 'div',
  minSize: 0,
  maxSize: 100,
});

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
  list: root.list,
  metadata: computed(() => ({ id: id.value })),
});

// A panel that `KeepAlive` holds is not in the layout. It keeps its last size until it shows again.
const size = computed<number>(
  (previous) =>
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- The panel registers in `setup`, so the layout of the first computation has an entry for its id.
    root.shown.value[id.value] ?? previous!,
);

const state = computed<ResizablePanelState>(() => ({
  orientation: root.orientation.value,
  size: size.value,
}));

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
  element,
  deactivated,
});

defineExpose({ element });
</script>

<template>
  <slot v-if="$slots.render" name="render" :props="elementProps()" :state="state" />
  <component :is="as" v-else v-bind="elementProps()"><slot :state="state" /></component>
</template>
