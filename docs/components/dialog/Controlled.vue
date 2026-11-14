<script setup lang="ts">
import { shallowRef } from 'vue';
import { Dialog } from '@vase-ui/vue/dialog';

declare function submitData(): Promise<void>;

const open = shallowRef(false);

// Close the dialog once the form data is submitted
async function handleSubmit() {
  await submitData();
  open.value = false;
}
</script>

<template>
  <Dialog.Root v-model:open="open">
    <Dialog.Trigger>Open</Dialog.Trigger>
    <Dialog.Portal>
      <Dialog.Popup>
        <form @submit.prevent="handleSubmit">
          <!-- ... -->
        </form>
      </Dialog.Popup>
    </Dialog.Portal>
  </Dialog.Root>
</template>
