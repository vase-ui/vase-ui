<script setup lang="ts">
import { Accordion } from '@ark-ui/vue/accordion';
</script>

<template>
  <Accordion.Root>
    <Accordion.Item value="item-1">
      <Accordion.ItemTrigger>Item 1<Accordion.ItemIndicator /></Accordion.ItemTrigger>
      <Accordion.ItemContent>Panel 1</Accordion.ItemContent>
    </Accordion.Item>
    <Accordion.Item value="item-2">
      <Accordion.ItemTrigger>Item 2<Accordion.ItemIndicator /></Accordion.ItemTrigger>
      <Accordion.ItemContent>Panel 2</Accordion.ItemContent>
    </Accordion.Item>
    <Accordion.Item value="item-3">
      <Accordion.ItemTrigger>Item 3<Accordion.ItemIndicator /></Accordion.ItemTrigger>
      <Accordion.ItemContent>Panel 3</Accordion.ItemContent>
    </Accordion.Item>
  </Accordion.Root>
</template>
