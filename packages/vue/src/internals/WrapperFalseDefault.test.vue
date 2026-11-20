<script setup lang="ts">
import { TimePicker } from '@vase-ui/vue/time-picker';

const props = withDefaults(defineProps<{ open?: boolean }>(), { open: false });
</script>

<template>
  <TimePicker.Root v-bind="props"><slot /></TimePicker.Root>
</template>
