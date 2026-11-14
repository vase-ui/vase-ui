<script setup lang="ts">
import { Switch } from '@vase-ui/vue/switch';
</script>

<template>
  <Switch.Root>
    <Switch.Thumb :state-class="(state) => (state.checked ? 'checked' : 'unchecked')" />
  </Switch.Root>
</template>
