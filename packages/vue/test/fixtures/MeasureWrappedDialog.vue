<script setup lang="ts">
import { ref, type PropType } from 'vue';
import { Dialog } from '../../src/dialog';
import WrappedDialog from './WrappedDialog.vue';

defineProps({
  log: { type: Object as PropType<{ add(entry: string): void }>, required: true },
});
const open = ref(false);
</script>

<template>
  <WrappedDialog
    v-model:open="open"
    @open-change="(value, details) => log.add(`openChange ${value} ${details.reason}`)"
    @update:open="(value) => log.add(`update:open ${value}`)"
  >
    <Dialog.Trigger>Open</Dialog.Trigger>
  </WrappedDialog>
  <output>{{ open }}</output>
</template>
