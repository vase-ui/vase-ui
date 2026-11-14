<script setup lang="ts">
import { Toast } from '@vase-ui/vue/toast';

const { add } = Toast.useToastManager();
</script>

<template>
  <button
    data-testid="add"
    type="button"
    @click="add({ title: 'Saved', description: 'The draft is saved.' })"
  >
    add
  </button>
</template>
