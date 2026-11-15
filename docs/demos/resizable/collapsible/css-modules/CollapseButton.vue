<script setup lang="ts">
import { computed } from 'vue';
import { Resizable } from '@vase-ui/vue/resizable';
import styles from './index.module.css';

const panel = Resizable.useParentPanel();
const collapsed = computed(() => panel?.state.value.collapsed ?? false);

function toggle() {
  if (collapsed.value) {
    panel?.expand();
  } else {
    panel?.collapse();
  }
}
</script>

<template>
  <button
    type="button"
    aria-label="Sidebar"
    :aria-expanded="!collapsed"
    :aria-controls="panel?.id.value"
    :class="styles.Button"
    @click="toggle"
  >
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" :class="styles.Icon">
      <path d="M10 4v8L5.5 8z" />
    </svg>
  </button>
</template>
