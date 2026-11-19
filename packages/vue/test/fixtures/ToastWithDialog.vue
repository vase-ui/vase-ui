<script setup lang="ts">
import ToastTextList from './ToastTextList.vue';
import { Dialog } from '@vase-ui/vue/dialog';
import { Toast } from '@vase-ui/vue/toast';
import type { ToastManager } from '../../src/toast/createToastManager';

defineProps<{
  manager: ToastManager;
}>();

const emit = defineEmits<{
  openChange: [open: boolean, eventDetails: Dialog.Root.ChangeEventDetails];
}>();
</script>

<template>
  <Toast.Provider :toast-manager="manager">
    <Dialog.Root
      default-open
      @open-change="(open, eventDetails) => emit('openChange', open, eventDetails)"
    >
      <Dialog.Portal>
        <Dialog.Popup data-testid="dialog">
          <Dialog.Title>Dialog</Dialog.Title>
          <button type="button">in dialog</button>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
    <Toast.Portal>
      <Toast.Viewport data-testid="viewport">
        <ToastTextList />
      </Toast.Viewport>
    </Toast.Portal>
  </Toast.Provider>
</template>
