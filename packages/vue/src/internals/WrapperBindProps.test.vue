<script setup lang="ts">
import { TimePicker } from '@vase-ui/vue/time-picker';

const props = defineProps<{ open?: boolean; closeOnSelect?: boolean }>();
</script>

<template>
  <TimePicker.Root v-bind="props"><slot /></TimePicker.Root>
</template>
