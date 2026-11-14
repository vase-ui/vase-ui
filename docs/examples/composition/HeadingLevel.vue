<script setup lang="ts">
import { Accordion } from '@vase-ui/vue/accordion';
</script>

<template>
  <Accordion.Root>
    <Accordion.Item>
      <Accordion.Header as="h2">
        <Accordion.Trigger>What is Vase UI?</Accordion.Trigger>
      </Accordion.Header>
      <Accordion.Panel>Vase UI is a library of unstyled Vue components.</Accordion.Panel>
    </Accordion.Item>
  </Accordion.Root>
</template>
