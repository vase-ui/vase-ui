<script setup lang="ts">
defineProps<{ text: string; hidden?: boolean | undefined }>();
</script>

<template>
  <span :aria-hidden="hidden ? 'true' : undefined">{{ text }}</span>
</template>
