<script setup lang="ts">
import { Accordion } from '../index';

defineProps<{ defaultValue?: number[] | undefined }>();
</script>

<template>
  <Accordion.Root :default-value="defaultValue">
    <Accordion.Item :value="0">
      <Accordion.Header>
        <Accordion.Trigger>Trigger 1</Accordion.Trigger>
      </Accordion.Header>
    </Accordion.Item>
    <Accordion.Item>
      <Accordion.Header>
        <Accordion.Trigger>Trigger 2</Accordion.Trigger>
      </Accordion.Header>
    </Accordion.Item>
  </Accordion.Root>
</template>
