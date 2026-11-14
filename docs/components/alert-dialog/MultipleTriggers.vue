<script setup lang="ts">
import { AlertDialog } from '@vase-ui/vue/alert-dialog';
</script>

<template>
  <AlertDialog.Root>
    <AlertDialog.Trigger>Trigger 1</AlertDialog.Trigger>
    <AlertDialog.Trigger>Trigger 2</AlertDialog.Trigger>
    <AlertDialog.Portal>
      <AlertDialog.Popup>
        <AlertDialog.Title>Alert dialog</AlertDialog.Title>
      </AlertDialog.Popup>
    </AlertDialog.Portal>
  </AlertDialog.Root>
</template>
