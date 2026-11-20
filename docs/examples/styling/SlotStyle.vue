<script setup lang="ts">
import { Dialog } from '@vase-ui/vue/dialog';
</script>

<template>
  <Dialog.Root>
    <Dialog.Trigger>
      <template #render="{ props, state }">
        <button v-bind="props" :ref="props.ref" :style="{ color: state.open ? 'red' : 'blue' }">
          Settings
        </button>
      </template>
    </Dialog.Trigger>
  </Dialog.Root>
</template>
