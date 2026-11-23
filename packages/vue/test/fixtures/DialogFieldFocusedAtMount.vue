<script setup lang="ts">
import type { PropType } from 'vue';
import { Dialog } from '../../src/dialog';
import NativeInputFocusedAtMount from './NativeInputFocusedAtMount.vue';

// A dialog in place that is open at the mount. Its field gives itself the focus at its mount, and
// it shows while `scene.field`.
defineProps({ scene: { type: Object as PropType<{ field: boolean }>, required: true } });
</script>

<template>
  <Dialog.Root default-open>
    <Dialog.Portal disabled>
      <Dialog.Popup data-testid="popup">
        <NativeInputFocusedAtMount v-if="scene.field" data-testid="field" aria-label="Field" />
        <button type="button">Save</button>
      </Dialog.Popup>
    </Dialog.Portal>
  </Dialog.Root>
</template>
