<script setup lang="ts">
import { Toggle } from '@vase-ui/vue/toggle';

withDefaults(defineProps<{ defaultPressed?: boolean; disabled?: boolean }>(), {
  defaultPressed: false,
  disabled: false,
});
</script>

<template>
  <Toggle data-testid="toggle" :default-pressed="defaultPressed" :disabled="disabled">
    Favorite
  </Toggle>
</template>
