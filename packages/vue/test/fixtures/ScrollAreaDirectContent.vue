<script setup lang="ts">
import type { PropType } from 'vue';
import { ScrollArea } from '../../src/scroll-area';

defineProps({
  scene: {
    type: Object as PropType<{
      lines?: number;
      text?: string;
      secondText?: string;
      box?: boolean;
      boxHeight?: number;
      wrap?: boolean;
      nestedText?: string;
      control?: boolean;
      content?: boolean;
      contentHeight?: number;
      extra?: boolean;
    }>,
    default: () => ({}),
  },
});
</script>

<template>
  <button type="button" class="before">Before</button>
  <ScrollArea.Root class="root" style="width: 200px; height: 200px">
    <ScrollArea.Viewport class="viewport" style="width: 100%; height: 100%">
      <ScrollArea.Content v-if="scene.content" class="content">
        <div :style="{ width: '100px', height: `${scene.contentHeight ?? 100}px` }" />
        <span v-if="scene.extra" class="extra" style="position: absolute">Extra</span>
      </ScrollArea.Content>
      <template v-else-if="scene.text !== undefined">{{ scene.text }}</template>
      <div v-else-if="scene.box" class="box" :style="{ height: `${scene.boxHeight ?? 50}px` }" />
      <div v-else-if="scene.wrap" class="wrap" style="min-height: 100%">
        <div class="fixed-row" style="height: 20px; overflow: hidden">
          <span class="nested-text">{{ scene.nestedText ?? 'Initial' }}</span>
        </div>
        <p v-for="line in scene.lines ?? 0" :key="line" style="margin: 0">
          Line {{ line }} of a text.
        </p>
      </div>
      <template v-else>
        <button v-if="scene.control" type="button" class="control">Control</button>
        <p v-for="line in scene.lines ?? 0" :key="line" style="margin: 0">
          Line {{ line }} of a text.
        </p>
      </template>
      <template v-if="scene.secondText !== undefined">{{ scene.secondText }}</template>
    </ScrollArea.Viewport>
  </ScrollArea.Root>
</template>
