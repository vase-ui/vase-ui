<script setup lang="ts">
import { Toast } from '@vase-ui/vue/toast';
import styles from './index.module.css';

const TEXTS = [
  'Short message.',
  'A bit longer message that spans two lines.',
  'This is a longer description that intentionally takes more vertical space to demonstrate stacking with varying heights.',
  'An even longer description that should span multiple lines so we can verify the clamped collapsed height and smooth expansion animation when hovering or focusing the viewport.',
];

const toastManager = Toast.useToastManager();
let count = 0;

function createToast() {
  count += 1;
  const description = TEXTS[Math.floor(Math.random() * TEXTS.length)];
  toastManager.add({
    title: `Toast ${count} created`,
    description,
  });
}
</script>

<template>
  <button type="button" :class="styles.Button" @click="createToast">
    Create varying height toast
  </button>
</template>
