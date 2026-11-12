<script setup lang="ts">
import { Separator } from '@vase-ui/vue/separator';
</script>

<template>
  <div class="items">
    <span>Home</span>
    <span>Pricing</span>
    <Separator class="separator" orientation="vertical" />
    <span>Log in</span>
    <span>Sign up</span>
  </div>
</template>

<style scoped>
.items {
  display: flex;
  gap: 1rem;
  font-size: 0.875rem;
}

.separator[data-orientation='vertical'] {
  width: 1px;
  background-color: color-mix(in srgb, currentColor 30%, transparent);
}
</style>
