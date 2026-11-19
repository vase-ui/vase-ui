<script setup lang="ts">
import { computed, shallowReactive } from 'vue';
import type { CSSProperties } from 'vue';
import * as ResizableHandleCssVariables from '../handle/ResizableHandleCssVariables';
import * as ResizableHandleDataAttributes from '../handle/ResizableHandleDataAttributes';
import { useResizeHandle } from '../utils/useResizeHandle';
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

// Both nodes of a split edge share one pointer capture.
const nodes = shallowReactive<(HTMLElement | null)[]>([]);
function setNode(index: number, value: unknown) {
  nodes[index] = value as HTMLElement | null;
}

const { dragging, crossing, ends, previewOffset, listeners } = useResizeHandle(root, {
  pivot,
  disabled: root.disabled,
  elements: nodes,
});

const attributes = computed(() => ({
  [ResizableHandleDataAttributes.orientation]: root.orientation.value,
  [ResizableHandleDataAttributes.dragging]: dragging.value ? '' : undefined,
  [ResizableHandleDataAttributes.crossing]: crossing.value ? '' : undefined,
  [ResizableHandleDataAttributes.atMin]: ends.value.atMin ? '' : undefined,
  [ResizableHandleDataAttributes.atMax]: ends.value.atMax ? '' : undefined,
  ...listeners,
}));

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
