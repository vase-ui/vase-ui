<script setup lang="ts">
import { Checkbox } from '@vase-ui/vue/checkbox';
</script>

<template>
  <div>
    <label for="notifications-checkbox">Enable notifications</label>
    <Checkbox.Root id="notifications-checkbox" native-button as="button">
      <Checkbox.Indicator />
    </Checkbox.Root>
  </div>
</template>
