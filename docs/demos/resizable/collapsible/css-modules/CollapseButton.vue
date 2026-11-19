<script setup lang="ts">
import styles from './index.module.css';

defineProps<{
  /** The panel is collapsed. */
  collapsed: boolean;
  /** The `id` of the panel. */
  controls: string;
}>();
defineEmits<{ toggle: [] }>();
</script>

<template>
  <button
    type="button"
    aria-label="Sidebar"
    :aria-expanded="!collapsed"
    :aria-controls="controls"
    :class="styles.Button"
    @click="$emit('toggle')"
  >
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="currentColor"
      aria-hidden="true"
      :class="styles.Icon"
    >
      <path d="M10 4v8L5.5 8z" />
    </svg>
  </button>
</template>
