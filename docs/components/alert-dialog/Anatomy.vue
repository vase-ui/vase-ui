<script setup lang="ts">
import { AlertDialog } from '@vase-ui/vue/alert-dialog';
</script>

<template>
  <AlertDialog.Root>
    <AlertDialog.Trigger />
    <AlertDialog.Portal>
      <AlertDialog.Backdrop />
      <AlertDialog.Viewport>
        <AlertDialog.Popup>
          <AlertDialog.Title />
          <AlertDialog.Description />
          <AlertDialog.Close />
        </AlertDialog.Popup>
      </AlertDialog.Viewport>
    </AlertDialog.Portal>
  </AlertDialog.Root>
</template>
