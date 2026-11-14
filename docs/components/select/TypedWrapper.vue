<script setup lang="ts" generic="Value, Multiple extends boolean | undefined = false">
import { Select } from '@vase-ui/vue/select';

const props = defineProps<Select.Root.Props<Value, Multiple>>();
</script>

<template>
  <Select.Root v-bind="props">
    <!-- ... -->
  </Select.Root>
</template>
