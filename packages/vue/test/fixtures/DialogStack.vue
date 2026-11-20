<script setup lang="ts">
import type { PropType } from 'vue';
import { Dialog } from '../../src/dialog';

// Two modal dialogs side by side, by `scene`. The first one has a backdrop and a viewport that cover
// the view, and its popup and its backdrop leave in a `<Transition>`.
defineProps({
  scene: { type: Object as PropType<{ first: boolean; second: boolean }>, required: true },
});
</script>

<template>
  <Dialog.Root v-model:open="scene.first">
    <Dialog.Portal>
      <Transition name="stack">
        <Dialog.Backdrop data-testid="first-backdrop" style="position: fixed; inset: 0" />
      </Transition>
      <Dialog.Viewport data-testid="first-viewport" style="position: fixed; inset: 0">
        <Transition name="stack">
          <Dialog.Popup data-testid="first-popup"><button>First</button></Dialog.Popup>
        </Transition>
      </Dialog.Viewport>
    </Dialog.Portal>
  </Dialog.Root>
  <Dialog.Root v-model:open="scene.second">
    <Dialog.Portal>
      <Dialog.Popup data-testid="second-popup" style="position: fixed; left: 300px; top: 0">
        <button>Second</button>
      </Dialog.Popup>
    </Dialog.Portal>
  </Dialog.Root>
</template>

<style>
.stack-leave-active {
  transition: opacity 300ms;
}
.stack-leave-to {
  opacity: 0;
}
</style>
