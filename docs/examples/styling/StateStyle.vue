<script setup lang="ts">
import { Switch } from '@vase-ui/vue/switch';
</script>

<template>
  <Switch.Root>
    <Switch.Thumb :state-style="(state) => ({ color: state.checked ? 'red' : 'blue' })" />
  </Switch.Root>
</template>
