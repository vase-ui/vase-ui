<script setup lang="ts">
import { computed } from 'vue';
import { Resizable } from '@vase-ui/vue/resizable';
import styles from './index.module.css';

const panel = Resizable.useParentPanel();
const expanded = computed(() => !(panel?.state.value.collapsed ?? false));

function toggle() {
  if (expanded.value) {
    panel?.collapse();
  } else {
    panel?.expand();
  }
}
</script>

<template>
  <button
    type="button"
    :aria-expanded="expanded"
    :aria-controls="panel?.id.value"
    :class="styles.Header"
    @click="toggle"
  >
    <slot />
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="currentColor"
      aria-hidden="true"
      :class="styles.Icon"
    >
      <path d="M4 6h8l-4 4.5z" />
    </svg>
  </button>
</template>
