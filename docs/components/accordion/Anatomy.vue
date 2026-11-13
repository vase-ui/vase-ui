<script setup lang="ts">
import { Accordion } from '@vase-ui/vue/accordion';
</script>

<template>
  <Accordion.Root>
    <Accordion.Item>
      <Accordion.Header>
        <Accordion.Trigger />
      </Accordion.Header>
      <Accordion.Panel />
    </Accordion.Item>
  </Accordion.Root>
</template>
