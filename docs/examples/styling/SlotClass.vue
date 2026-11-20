<script setup lang="ts">
import { Dialog } from '@vase-ui/vue/dialog';
</script>

<template>
  <Dialog.Root>
    <Dialog.Trigger>
      <template #render="{ props, state }">
        <button v-bind="props" :ref="props.ref" :class="state.open ? 'open' : 'closed'">
          Settings
        </button>
      </template>
    </Dialog.Trigger>
  </Dialog.Root>
</template>
