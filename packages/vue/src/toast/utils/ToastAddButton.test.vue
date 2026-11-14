<script setup lang="ts">
import { useToastManager } from '../useToastManager';

const { add } = useToastManager();

function addToast() {
  add({
    title: 'title',
    description: 'description',
    actionProps: {
      id: 'action',
      children: 'action',
    },
  });
}
</script>

<template>
  <button type="button" @click="addToast">add</button>
</template>
