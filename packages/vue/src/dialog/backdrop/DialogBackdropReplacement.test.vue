<script setup lang="ts">
import DialogPopupPart from '../../../test/fixtures/DialogPopupPart.vue';
import * as Dialog from '../index.parts';

defineProps<{ first: boolean }>();
</script>

<template>
  <div>
    <button>outside</button>
    <Dialog.Root default-open>
      <Dialog.Backdrop v-if="!first" data-testid="second" />
      <Dialog.Backdrop v-if="first" data-testid="first" />
      <DialogPopupPart />
    </Dialog.Root>
  </div>
</template>
