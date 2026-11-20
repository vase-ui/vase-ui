<script setup lang="ts">
import type { PropType } from 'vue';
import { Dialog } from '../../src/dialog';

// An open dialog with a title and a description for each key of `scene.titles`, in that order.
defineProps({
  scene: { type: Object as PropType<{ titles: string[] }>, required: true },
  popup: Object as PropType<Record<string, unknown>>,
});
</script>

<template>
  <Dialog.Root default-open :modal="false">
    <Dialog.Portal>
      <Dialog.Popup data-testid="popup" v-bind="popup">
        <template v-for="key in scene.titles" :key="key">
          <Dialog.Title :data-testid="`title-${key}`">Title {{ key }}</Dialog.Title>
          <Dialog.Description :data-testid="`description-${key}`">
            Description {{ key }}
          </Dialog.Description>
        </template>
      </Dialog.Popup>
    </Dialog.Portal>
  </Dialog.Root>
</template>
