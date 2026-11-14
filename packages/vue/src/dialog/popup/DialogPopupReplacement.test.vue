<script setup lang="ts">
import { DialogStoreProbe } from '../../../test/fixtures/dialogStoreProbe';
import { Dialog } from '@vase-ui/vue/dialog';
import type { DialogStore } from '../store/DialogStore';

defineProps<{ first: boolean; onStore: (store: DialogStore<unknown>) => void }>();
</script>

<template>
  <Dialog.Root default-open :modal="false">
    <DialogStoreProbe :on-store="onStore" />
    <Dialog.Portal>
      <Dialog.Popup v-if="!first" data-testid="second" />
      <Dialog.Popup v-if="first" data-testid="first" />
    </Dialog.Portal>
  </Dialog.Root>
</template>
