<script setup lang="ts">
import { Collapsible } from '../index';

defineProps<{ first: boolean }>();
</script>

<template>
  <Collapsible.Root default-open>
    <Collapsible.Trigger>Trigger</Collapsible.Trigger>
    <Collapsible.Panel v-if="!first" data-testid="panel">Panel 2</Collapsible.Panel>
    <Collapsible.Panel v-if="first" data-testid="panel">Panel 1</Collapsible.Panel>
  </Collapsible.Root>
</template>
