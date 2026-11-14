<script setup lang="ts">
import DialogPopupPart from '../../../test/fixtures/DialogPopupPart.vue';
import * as Drawer from '../index.parts';

defineProps<{ first: boolean }>();
</script>

<template>
  <div>
    <button>outside</button>
    <Drawer.Root default-open>
      <Drawer.Backdrop v-if="!first" data-testid="second" />
      <Drawer.Backdrop v-if="first" data-testid="first" />
      <DialogPopupPart />
    </Drawer.Root>
  </div>
</template>
