<script setup lang="ts">
import { shallowRef } from 'vue';
import { Dialog } from '../../src/dialog';

// A button in the first modal dialog closes it and opens the second modal dialog in one task. The
// second dialog has no trigger.
const first = shallowRef(false);
const second = shallowRef(false);

function next() {
  first.value = false;
  second.value = true;
}
</script>

<template>
  <Dialog.Root v-model:open="first">
    <Dialog.Trigger data-testid="first-trigger">Open</Dialog.Trigger>
    <Dialog.Portal>
      <Dialog.Popup data-testid="first-popup" style="position: fixed; left: 40px; top: 40px">
        <button data-testid="next" @click="next">Next</button>
      </Dialog.Popup>
    </Dialog.Portal>
  </Dialog.Root>
  <Dialog.Root v-model:open="second">
    <Dialog.Portal>
      <Dialog.Popup data-testid="second-popup" style="position: fixed; left: 200px; top: 40px">
        <Dialog.Close data-testid="close">Close</Dialog.Close>
      </Dialog.Popup>
    </Dialog.Portal>
  </Dialog.Root>
</template>
