<script setup lang="ts">
import { computed } from 'vue';
import { Resizable } from '@vase-ui/vue/resizable';

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
    class="group box-border flex h-10 w-full items-center justify-between border-0 bg-transparent px-4 text-sm font-medium text-neutral-950 outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-neutral-950 dark:text-white dark:focus-visible:outline-white"
    @click="toggle"
  >
    <slot />
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" class="group-aria-[expanded=false]:-rotate-90">
      <path d="M4 6h8l-4 4.5z" />
    </svg>
  </button>
</template>
