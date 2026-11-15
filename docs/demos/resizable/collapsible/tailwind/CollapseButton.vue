<script setup lang="ts">
import { computed } from 'vue';
import { Resizable } from '@vase-ui/vue/resizable';

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
    class="group box-border flex size-8 flex-none items-center justify-center rounded-md border border-neutral-200 p-0 text-neutral-950 outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-950 dark:border-neutral-800 dark:text-white dark:focus-visible:outline-white"
    @click="toggle"
  >
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" class="group-aria-[expanded=false]:rotate-180">
      <path d="M10 4v8L5.5 8z" />
    </svg>
  </button>
</template>
