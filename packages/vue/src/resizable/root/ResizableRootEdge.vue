<script setup lang="ts">
import { computed, onScopeDispose, shallowRef, watch } from 'vue';
import type { CSSProperties } from 'vue';
import { useKeepAliveState } from '../../internals/useKeepAliveState';
import * as ResizableHandleCssVariables from '../handle/ResizableHandleCssVariables';
import * as ResizableHandleDataAttributes from '../handle/ResizableHandleDataAttributes';
import { createHandleDrag } from '../utils/handleDrag';
import { getHandleEnds } from '../utils/handleEnds';
import { createHandlePress } from '../utils/handlePress';
import { registerHandle } from '../utils/handleRegistry';
import { getPreviewOffset } from '../utils/previewOffset';
import type { EdgeBoundary, EdgeBox } from '../utils/useEdges';
import { useResizableRootContext } from './ResizableRootContext';

const props = defineProps<{
  boundary: EdgeBoundary;
}>();

const root = useResizableRootContext();

// The index in `panels` of the panel before the boundary. A boundary that the panels lost has -1.
const pivot = computed(() => {
  const panels = root.panels.value;
  const before = panels.indexOf(props.boundary.before);
  return before < panels.length - 1 ? before : -1;
});

const drag = createHandleDrag(root, {
  pivot: () => pivot.value,
  disabled: () => root.disabled.value,
});
const press = createHandlePress({ drag, orientation: () => root.orientation.value });

// An edge can have two nodes. They share the drag and the press.
const nodes = shallowRef<readonly (HTMLElement | null)[]>([]);

function setNode(index: number, value: unknown) {
  const node = value as HTMLElement | null;
  // Vue calls a function ref again on each patch, with the same element.
  if ((nodes.value[index] ?? null) === node) {
    return;
  }
  const next = [...nodes.value];
  next[index] = node;
  nodes.value = next;
}

watch(
  nodes,
  (list, _previous, onCleanup) => {
    const unregister = list.flatMap((element) =>
      element
        ? [
            registerHandle({
              element,
              drag,
              orientation: () => root.orientation.value,
              hitAreaSize: () => root.hitAreaSize.value,
            }),
          ]
        : [],
    );
    onCleanup(() => {
      for (const remove of unregister) {
        remove();
      }
    });
  },
  { flush: 'post' },
);

// The unmount of the edge and `KeepAlive` end the press that this edge started, and the drag that
// the press of another handle or edge started on it.
function endDrags() {
  press.end();
  drag.end(undefined, false);
}

const { isHeld } = useKeepAliveState();
watch(
  isHeld,
  (held) => {
    if (held) {
      endDrags();
    }
  },
  { flush: 'sync' },
);
onScopeDispose(endDrags);

const attributes = computed(() => {
  const ends = getHandleEnds(root, pivot.value);
  return {
    [ResizableHandleDataAttributes.orientation]: root.orientation.value,
    [ResizableHandleDataAttributes.dragging]: drag.dragging.value ? '' : undefined,
    [ResizableHandleDataAttributes.crossing]: drag.crossing.value ? '' : undefined,
    [ResizableHandleDataAttributes.atMin]: ends.atMin ? '' : undefined,
    [ResizableHandleDataAttributes.atMax]: ends.atMax ? '' : undefined,
    ...press.listeners,
  };
});

const previewOffset = computed(() => getPreviewOffset(root, pivot.value, drag.dragging.value));

function getStyle(box: EdgeBox): CSSProperties {
  return {
    position: 'absolute',
    left: `${box.left}px`,
    top: `${box.top}px`,
    width: `${box.width}px`,
    height: `${box.height}px`,
    zIndex: 1,
    touchAction: 'none',
    // Safari 16.4, a target of the build, has only the prefixed property.
    '-webkit-user-select': 'none',
    userSelect: 'none',
    [ResizableHandleCssVariables.resizableHandlePreviewOffset]: previewOffset.value,
  };
}
</script>

<template>
  <span
    v-for="(box, index) in boundary.areas"
    :key="index"
    :ref="(value) => setNode(index, value)"
    data-vase-ui-resizable-edge
    v-bind="attributes"
    :style="getStyle(box)"
  />
</template>
