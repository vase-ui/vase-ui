<script setup lang="ts">
import { Switch } from '@vase-ui/vue/switch';
</script>

<template>
  <div class="field">
    <Switch.Root class="switch">
      <Switch.Thumb class="thumb" />
    </Switch.Root>
  </div>
</template>

<style scoped>
.thumb {
  background-color: green;
}

.field :deep(.switch) {
  border: 1px solid green;
}
</style>
