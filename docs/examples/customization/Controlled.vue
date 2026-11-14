<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { Dialog } from '@vase-ui/vue/dialog';

const open = ref(false);
let timeout: ReturnType<typeof setTimeout> | undefined;

onMounted(() => {
  timeout = setTimeout(() => {
    open.value = true;
  }, 1000);
});

onBeforeUnmount(() => {
  clearTimeout(timeout);
});
</script>

<template>
  <Dialog.Root v-model:open="open">
    <Dialog.Portal>
      <Dialog.Popup>No trigger is needed in this case.</Dialog.Popup>
    </Dialog.Portal>
  </Dialog.Root>
</template>
