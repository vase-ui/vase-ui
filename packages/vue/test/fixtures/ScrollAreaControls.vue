<script setup lang="ts">
import type { PropType } from 'vue';
import { ScrollArea } from '../../src/scroll-area';

defineProps({
  scene: {
    type: Object as PropType<{
      control?: boolean;
      disabled?: boolean;
      shown?: boolean;
      /** The class `gone`, which the case styles. */
      gone?: boolean;
      markup?: string;
      hidden?: boolean;
      tall?: boolean;
    }>,
    default: () => ({}),
  },
});
</script>

<template>
  <button type="button" class="before">Before</button>
  <ScrollArea.Root style="width: 200px; height: 200px" :hidden="scene.hidden">
    <ScrollArea.Viewport class="viewport" style="width: 100%; height: 100%">
      <button
        v-if="scene.control"
        v-show="scene.shown !== false"
        type="button"
        class="control"
        :class="{ gone: scene.gone }"
        :disabled="scene.disabled"
      >
        Control
      </button>
      <button type="button" tabindex="-1">Not a tab stop</button>
      <div v-if="scene.markup" class="markup" v-html="scene.markup" />
      <div v-if="scene.tall !== false" style="height: 1000px" />
    </ScrollArea.Viewport>
  </ScrollArea.Root>
</template>
