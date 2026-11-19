<script setup lang="ts">
import { useTemplateRef, type PropType } from 'vue';
import { ScrollArea } from '../../src/scroll-area';

type Attrs = Record<string, unknown>;

defineProps({
  /** The size of the content, and the parts that render. */
  scene: {
    type: Object as PropType<{
      width?: number;
      height?: number;
      vertical?: boolean;
      horizontal?: boolean;
      corner?: boolean;
      viewport?: boolean;
      content?: boolean;
      thumb?: boolean;
      /** Items of 200px for scroll snap, in place of the one block of the content. */
      items?: number;
      /** A second vertical scrollbar, 20px wide, after the first. */
      second?: boolean;
    }>,
    default: () => ({}),
  },
  root: Object as PropType<Attrs>,
  viewport: Object as PropType<Attrs>,
  content: Object as PropType<Attrs>,
  vertical: Object as PropType<Attrs>,
  horizontal: Object as PropType<Attrs>,
  thumbY: Object as PropType<Attrs>,
  thumbX: Object as PropType<Attrs>,
  corner: Object as PropType<Attrs>,
});
const rootPart = useTemplateRef('rootPart');
const viewportPart = useTemplateRef('viewportPart');
const contentPart = useTemplateRef('contentPart');
const verticalPart = useTemplateRef('verticalPart');
const horizontalPart = useTemplateRef('horizontalPart');
const thumbYPart = useTemplateRef('thumbYPart');
const thumbXPart = useTemplateRef('thumbXPart');
const cornerPart = useTemplateRef('cornerPart');
defineExpose({
  root: rootPart,
  viewport: viewportPart,
  content: contentPart,
  vertical: verticalPart,
  horizontal: horizontalPart,
  thumbY: thumbYPart,
  thumbX: thumbXPart,
  corner: cornerPart,
});
</script>

<template>
  <ScrollArea.Root ref="rootPart" class="root" style="width: 200px; height: 200px" v-bind="root">
    <ScrollArea.Viewport
      v-if="scene.viewport !== false"
      ref="viewportPart"
      class="viewport"
      style="width: 100%; height: 100%"
      v-bind="viewport"
    >
      <ScrollArea.Content v-if="scene.content !== false" ref="contentPart" class="content" v-bind="content">
        <template v-if="scene.items">
          <div
            v-for="item in scene.items"
            :key="item"
            style="flex-shrink: 0; width: 200px; height: 100px; scroll-snap-align: start"
          />
        </template>
        <div v-else :style="{ width: `${scene.width ?? 1000}px`, height: `${scene.height ?? 1000}px` }" />
      </ScrollArea.Content>
    </ScrollArea.Viewport>
    <ScrollArea.Scrollbar
      v-if="scene.vertical !== false"
      ref="verticalPart"
      class="vertical"
      style="width: 10px"
      v-bind="vertical"
    >
      <ScrollArea.Thumb v-if="scene.thumb !== false" ref="thumbYPart" class="thumb-y" v-bind="thumbY">
        <span class="grip" style="display: block; height: 4px" />
      </ScrollArea.Thumb>
    </ScrollArea.Scrollbar>
    <ScrollArea.Scrollbar v-if="scene.second" class="second" style="width: 20px">
      <ScrollArea.Thumb class="second-thumb" />
    </ScrollArea.Scrollbar>
    <ScrollArea.Scrollbar
      v-if="scene.horizontal !== false"
      ref="horizontalPart"
      orientation="horizontal"
      class="horizontal"
      style="height: 10px"
      v-bind="horizontal"
    >
      <ScrollArea.Thumb ref="thumbXPart" class="thumb-x" v-bind="thumbX" />
    </ScrollArea.Scrollbar>
    <ScrollArea.Corner v-if="scene.corner" ref="cornerPart" class="corner" v-bind="corner" />
  </ScrollArea.Root>
</template>
