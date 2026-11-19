<script setup lang="ts">
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
    class="group box-border flex h-10 w-full items-center justify-between border-0 bg-transparent px-4 text-sm font-medium text-neutral-950 outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-neutral-950 dark:text-white dark:focus-visible:outline-white"
    @click="$emit('toggle')"
  >
    <slot />
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="currentColor"
      aria-hidden="true"
      class="group-aria-[expanded=false]:-rotate-90"
    >
      <path d="M4 6h8l-4 4.5z" />
    </svg>
  </button>
</template>
