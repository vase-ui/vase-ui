<script setup lang="ts">
import DialogPortalPart from '../../../test/fixtures/DialogPortalPart.vue';
import { DialogStoreProbe } from '../../../test/fixtures/dialogStoreProbe';
import * as Dialog from '../index.parts';
import type { DialogStore } from '../store/DialogStore';

defineProps<{ first: boolean; onStore: (store: DialogStore<unknown>) => void }>();
</script>

<template>
  <Dialog.Root default-open :modal="false">
    <DialogStoreProbe :on-store="onStore" />
    <DialogPortalPart>
      <Dialog.Viewport v-if="!first" data-testid="second" />
      <Dialog.Viewport v-if="first" data-testid="first" />
    </DialogPortalPart>
  </Dialog.Root>
</template>
