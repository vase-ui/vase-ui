<script setup lang="ts">
import {
  AccordionContent,
  AccordionHeader,
  AccordionItem,
  AccordionRoot,
  AccordionTrigger,
} from 'reka-ui';
</script>

<template>
  <AccordionRoot>
    <AccordionItem value="item-1">
      <AccordionHeader>
        <AccordionTrigger>Item 1</AccordionTrigger>
      </AccordionHeader>
      <AccordionContent>Panel 1</AccordionContent>
    </AccordionItem>
    <AccordionItem value="item-2">
      <AccordionHeader>
        <AccordionTrigger>Item 2</AccordionTrigger>
      </AccordionHeader>
      <AccordionContent>Panel 2</AccordionContent>
    </AccordionItem>
    <AccordionItem value="item-3">
      <AccordionHeader>
        <AccordionTrigger>Item 3</AccordionTrigger>
      </AccordionHeader>
      <AccordionContent>Panel 3</AccordionContent>
    </AccordionItem>
  </AccordionRoot>
</template>
