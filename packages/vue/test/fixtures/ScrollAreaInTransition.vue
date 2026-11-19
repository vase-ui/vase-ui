<script setup lang="ts">
import type { PropType } from 'vue';
import { ScrollArea } from '../../src/scroll-area';

defineProps({ scene: { type: Object as PropType<{ height: number }>, required: true } });
</script>

<template>
  <ScrollArea.Root style="width: 200px; height: 200px">
    <ScrollArea.Viewport class="viewport" style="width: 100%; height: 100%">
      <ScrollArea.Content>
        <div :style="{ width: `${scene.height}px`, height: `${scene.height}px` }" />
      </ScrollArea.Content>
    </ScrollArea.Viewport>
    <Transition>
      <ScrollArea.Scrollbar class="vertical" style="width: 10px" />
    </Transition>
    <ScrollArea.Scrollbar orientation="horizontal" style="height: 10px" />
    <Transition>
      <ScrollArea.Corner class="corner" />
    </Transition>
  </ScrollArea.Root>
</template>
