<script setup lang="ts">
import { h } from 'vue';
import { useToastManager } from '../useToastManager';
import ToastViewportLabel from './ToastViewportLabel.test.vue';

const props = defineProps<{
  label: 'text' | 'component';
}>();

// A part that adds a high priority toast in `setup`, where a server render can reach it. The
// buttons let a test close the toast and add it again.
const { add, close } = useToastManager();

function addToast() {
  add({
    id: 'saved',
    title: props.label === 'component' ? () => h(ToastViewportLabel) : 'Saved',
    description: 'The file is saved.',
    priority: 'high',
    timeout: 0,
  });
}

addToast();
</script>

<template>
  <button type="button" data-testid="add" @click="addToast">add</button>
  <button type="button" data-testid="close" @click="close()">close</button>
</template>
