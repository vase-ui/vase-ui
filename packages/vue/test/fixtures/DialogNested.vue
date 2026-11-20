<script setup lang="ts">
import type { PropType } from 'vue';
import { AlertDialog } from '../../src/alert-dialog';
import { Dialog } from '../../src/dialog';

type Props = Record<string, unknown>;

// A dialog with the trigger `nested`, for the popup of another dialog. With `alert`, its root and
// its trigger are those of Alert Dialog.
const POPUP_STYLE = 'position: fixed; left: 300px; top: 200px';
defineProps({
  alert: Boolean,
  root: Object as PropType<Props>,
  portal: Object as PropType<Props>,
  backdrop: Object as PropType<Props>,
  viewport: Object as PropType<Props>,
  popup: Object as PropType<Props>,
});
</script>

<template>
  <component :is="alert ? AlertDialog.Root : Dialog.Root" v-bind="root">
    <component :is="alert ? AlertDialog.Trigger : Dialog.Trigger" data-key="nested">
      nested
    </component>
    <Dialog.Portal v-bind="portal">
      <Dialog.Backdrop v-if="backdrop" data-testid="nested-backdrop" v-bind="backdrop" />
      <Dialog.Viewport v-if="viewport" data-testid="nested-viewport" v-bind="viewport">
        <Dialog.Popup data-testid="nested-popup" :style="POPUP_STYLE" v-bind="popup">
          <button data-testid="nested-button">Nested</button>
          <Dialog.Close data-testid="nested-close">Close</Dialog.Close>
        </Dialog.Popup>
      </Dialog.Viewport>
      <Dialog.Popup v-else data-testid="nested-popup" :style="POPUP_STYLE" v-bind="popup">
        <button data-testid="nested-button">Nested</button>
        <Dialog.Close data-testid="nested-close">Close</Dialog.Close>
      </Dialog.Popup>
    </Dialog.Portal>
  </component>
</template>
