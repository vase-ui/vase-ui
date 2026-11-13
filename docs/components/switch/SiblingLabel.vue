<script setup lang="ts">
import { Switch } from '@vase-ui/vue/switch';
</script>

<template>
  <div>
    <label for="notifications-switch">Notifications</label>
    <Switch.Root id="notifications-switch" native-button as="button">
      <Switch.Thumb />
    </Switch.Root>
  </div>
</template>
