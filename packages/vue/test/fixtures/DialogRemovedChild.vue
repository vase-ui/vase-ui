<script setup lang="ts">
import { shallowRef } from 'vue';
import { Dialog } from '../../src/dialog';

// An open `'trap-focus'` dialog whose first button unmounts at its own `pointerdown`.
const shown = shallowRef(true);
</script>

<template>
  <Dialog.Root default-open modal="trap-focus">
    <Dialog.Portal>
      <Dialog.Popup data-testid="popup" style="position: fixed; left: 200px; top: 100px">
        <button v-if="shown" data-testid="remove" @pointerdown="shown = false">Remove</button>
        <p>Content</p>
      </Dialog.Popup>
    </Dialog.Portal>
  </Dialog.Root>
</template>
