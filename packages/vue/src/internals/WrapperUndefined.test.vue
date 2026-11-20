<script setup lang="ts">
import { TimePicker } from '@vase-ui/vue/time-picker';

const props = withDefaults(defineProps<{ open?: boolean; closeOnSelect?: boolean }>(), {
  open: undefined,
  closeOnSelect: undefined,
});
</script>

<template>
  <TimePicker.Root v-bind="props"><slot /></TimePicker.Root>
</template>
