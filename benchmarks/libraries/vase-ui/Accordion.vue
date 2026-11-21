<script setup lang="ts">
import { Accordion } from '@vase-ui/vue/accordion';
</script>

<template>
  <Accordion.Root>
    <Accordion.Item>
      <Accordion.Header>
        <Accordion.Trigger>Item 1</Accordion.Trigger>
      </Accordion.Header>
      <Accordion.Panel>Panel 1</Accordion.Panel>
    </Accordion.Item>
    <Accordion.Item>
      <Accordion.Header>
        <Accordion.Trigger>Item 2</Accordion.Trigger>
      </Accordion.Header>
      <Accordion.Panel>Panel 2</Accordion.Panel>
    </Accordion.Item>
    <Accordion.Item>
      <Accordion.Header>
        <Accordion.Trigger>Item 3</Accordion.Trigger>
      </Accordion.Header>
      <Accordion.Panel>Panel 3</Accordion.Panel>
    </Accordion.Item>
  </Accordion.Root>
</template>
