<script setup lang="ts">
import { Switch } from '@vase-ui/vue/switch';
</script>

<template>
  <Switch.Root native-button>
    <template #render="{ props }">
      <label>
        <button v-bind="props" />
        Notifications
      </label>
    </template>
  </Switch.Root>
</template>
