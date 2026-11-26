<script setup lang="ts">
import { ref, type PropType } from 'vue';
import { Dialog } from '../../src/dialog';
import PopupContentOnMounted from './PopupContentOnMounted.vue';
import type { PopupContentReading } from './popupContent';

// A dialog that a button outside it opens through `v-model:open`, and that also has a trigger. Its
// content takes the focus in `onMounted`.
defineProps({
  log: { type: Object as PropType<{ add(entry: PopupContentReading): void }>, required: true },
});
const open = ref(false);
</script>

<template>
  <button type="button" data-testid="opener" @click="open = true">Open</button>
  <Dialog.Root v-model:open="open">
    <Dialog.Trigger data-testid="trigger">Trigger</Dialog.Trigger>
    <Dialog.Portal>
      <Dialog.Popup data-testid="popup">
        <PopupContentOnMounted :log />
      </Dialog.Popup>
    </Dialog.Portal>
  </Dialog.Root>
</template>
