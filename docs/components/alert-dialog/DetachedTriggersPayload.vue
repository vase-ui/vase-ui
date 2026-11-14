<script setup lang="ts">
import { AlertDialog } from '@vase-ui/vue/alert-dialog';

const demoAlertDialog = AlertDialog.createHandle<{ message: string }>();
</script>

<template>
  <AlertDialog.Trigger :handle="demoAlertDialog" :payload="{ message: 'Trigger 1' }">
    Trigger 1
  </AlertDialog.Trigger>
  <AlertDialog.Trigger :handle="demoAlertDialog" :payload="{ message: 'Trigger 2' }">
    Trigger 2
  </AlertDialog.Trigger>

  <AlertDialog.Root :handle="demoAlertDialog">
    <template #default="{ payload }">
      <AlertDialog.Portal>
        <AlertDialog.Popup>
          <AlertDialog.Title>Alert dialog</AlertDialog.Title>
          <AlertDialog.Description v-if="payload !== undefined">
            Confirming {{ payload.message }}
          </AlertDialog.Description>
        </AlertDialog.Popup>
      </AlertDialog.Portal>
    </template>
  </AlertDialog.Root>
</template>
