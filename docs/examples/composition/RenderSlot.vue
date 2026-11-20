<script setup lang="ts">
import { Dialog } from '@vase-ui/vue/dialog';
</script>

<template>
  <Dialog.Root>
    <Dialog.Trigger>
      <template #render="{ props, state }">
        <button v-bind="props" :ref="props.ref">
          <template v-if="state.open">Open</template>
          <template v-else>Closed</template>
        </button>
      </template>
    </Dialog.Trigger>
  </Dialog.Root>
</template>
