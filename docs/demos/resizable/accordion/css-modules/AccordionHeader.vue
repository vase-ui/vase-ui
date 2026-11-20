<script setup lang="ts">
import styles from './index.module.css';

defineProps<{
  /** The panel is expanded. */
  expanded: boolean;
  /** The `id` of the panel. */
  controls: string;
}>();
defineEmits<{ toggle: [] }>();
</script>

<template>
  <button
    type="button"
    :aria-expanded="expanded"
    :aria-controls="controls"
    :class="styles.Header"
    @click="$emit('toggle')"
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
