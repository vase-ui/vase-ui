<script setup lang="ts">
import { Accordion } from '../index';

defineProps<{ triggerId?: string | undefined }>();
</script>

<template>
  <Accordion.Root :default-value="[0]">
    <Accordion.Item :value="0">
      <Accordion.Panel>Panel contents 1</Accordion.Panel>
      <Accordion.Header>
        <Accordion.Trigger :id="triggerId">Trigger 1</Accordion.Trigger>
      </Accordion.Header>
    </Accordion.Item>
  </Accordion.Root>
</template>
