<script setup lang="ts">
import { Dialog } from '@vase-ui/vue/dialog';

const demoDialog = Dialog.createHandle<{ text: string }>();
</script>

<template>
  <Dialog.Trigger :handle="demoDialog" :payload="{ text: 'Trigger 1' }">Trigger 1</Dialog.Trigger>
  <Dialog.Trigger :handle="demoDialog" :payload="{ text: 'Trigger 2' }">Trigger 2</Dialog.Trigger>

  <Dialog.Root :handle="demoDialog">
    <template #default="{ payload }">
      <Dialog.Portal>
        <Dialog.Popup>
          <Dialog.Title>Dialog</Dialog.Title>
          <Dialog.Description v-if="payload !== undefined">
            This has been opened by {{ payload.text }}
          </Dialog.Description>
        </Dialog.Popup>
      </Dialog.Portal>
    </template>
  </Dialog.Root>
</template>
