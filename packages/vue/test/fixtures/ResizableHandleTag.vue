<script setup lang="ts">
import type { PropType } from 'vue';
import { Resizable } from '../../src/resizable';

// The `element` slot of the handle renders `scene.tag`, so the handle can get a new element.
defineProps({
  scene: {
    type: Object as PropType<{ tag: string; root?: Record<string, unknown> }>,
    required: true,
  },
});
</script>

<template>
  <div style="width: 400px; height: 100px">
    <Resizable.Root style="height: 100%" data-key="root" v-bind="scene.root">
      <Resizable.Panel id="a" />
      <Resizable.Handle aria-label="Resize a">
        <template #element="{ props, elementRef }">
          <component
            :is="scene.tag"
            v-bind="props"
            :ref="elementRef"
            data-key="h1"
            style="width: 8px"
          />
        </template>
      </Resizable.Handle>
      <Resizable.Panel id="b" />
    </Resizable.Root>
  </div>
</template>
