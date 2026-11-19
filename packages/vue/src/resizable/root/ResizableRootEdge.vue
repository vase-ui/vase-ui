<script setup lang="ts">
import { computed, shallowReactive } from 'vue';
import * as ResizableHandleCssVariables from '../handle/ResizableHandleCssVariables';
import { useResizeHandle } from '../utils/useResizeHandle';
import type { EdgeBoundary } from './ResizableRootContext';
import { useResizableRootContext } from './ResizableRootContext';

const props = defineProps<{
  boundary: EdgeBoundary;
}>();

const root = useResizableRootContext();
const { orientation } = root;

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
</script>

<template>
  <span
    v-for="(box, index) in boundary.areas"
    :key="index"
    :ref="(value) => setNode(index, value)"
    data-vase-ui-resizable-edge
    v-bind="listeners"
    :data-orientation="orientation"
    :data-dragging="dragging ? '' : undefined"
    :data-crossing="crossing ? '' : undefined"
    :data-at-min="ends.atMin ? '' : undefined"
    :data-at-max="ends.atMax ? '' : undefined"
    style="
      position: absolute;
      z-index: 1;
      touch-action: none;
      -webkit-user-select: none;
      user-select: none;
    "
    :style="{
      left: `${box.left}px`,
      top: `${box.top}px`,
      width: `${box.width}px`,
      height: `${box.height}px`,
      [ResizableHandleCssVariables.resizableHandlePreviewOffset]: previewOffset,
    }"
  />
</template>
