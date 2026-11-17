<script setup vapor lang="ts">
import { Collapsible } from '../collapsible';

const props = withDefaults(defineProps<{ open?: boolean | undefined }>(), { open: undefined });
</script>

<template>
  <Collapsible.Root v-bind="props">
    <Collapsible.Trigger>Toggle</Collapsible.Trigger>
    <Collapsible.Panel>Content</Collapsible.Panel>
  </Collapsible.Root>
</template>
