<script setup lang="ts">
import { Accordion } from '../index';

defineProps<{ first: boolean }>();
</script>

<template>
  <Accordion.Root :default-value="['a']">
    <Accordion.Item value="a">
      <Accordion.Header>
        <Accordion.Trigger v-if="!first">Second</Accordion.Trigger>
        <Accordion.Trigger v-if="first">First</Accordion.Trigger>
      </Accordion.Header>
      <Accordion.Panel data-testid="panel">Panel</Accordion.Panel>
    </Accordion.Item>
  </Accordion.Root>
</template>
