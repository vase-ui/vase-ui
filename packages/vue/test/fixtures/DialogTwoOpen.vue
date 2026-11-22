<script setup lang="ts">
import type { PropType } from 'vue';
import { Dialog } from '../../src/dialog';

// Two sibling dialogs that open at the mount. Neither popup takes the focus. A change of
// `scene.key` mounts the popup of the first dialog again.
defineProps({
  scene: { type: Object as PropType<{ key: number }>, default: () => ({ key: 0 }) },
});
</script>

<template>
  <Dialog.Root default-open>
    <Dialog.Portal>
      <Dialog.Popup :key="scene.key" data-testid="a" :initial-focus="false">A</Dialog.Popup>
    </Dialog.Portal>
  </Dialog.Root>
  <Dialog.Root default-open>
    <Dialog.Portal>
      <Dialog.Popup data-testid="b" :initial-focus="false">B</Dialog.Popup>
    </Dialog.Portal>
  </Dialog.Root>
</template>
