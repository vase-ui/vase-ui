<script setup lang="ts">
import { AlertDialog } from '@vase-ui/vue/alert-dialog';

const demoAlertDialog = AlertDialog.createHandle();
</script>

<template>
  <AlertDialog.Trigger :handle="demoAlertDialog">Open</AlertDialog.Trigger>

  <AlertDialog.Root :handle="demoAlertDialog">
    <AlertDialog.Portal>
      <AlertDialog.Popup>
        <AlertDialog.Title>Alert dialog</AlertDialog.Title>
      </AlertDialog.Popup>
    </AlertDialog.Portal>
  </AlertDialog.Root>
</template>
