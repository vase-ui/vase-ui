<script setup lang="ts">
import { Accordion } from '@vase-ui/vue/accordion';
import SlotHost from './SlotHost.test.vue';
</script>

<template>
  <Accordion.Root>
    <Accordion.Item>
      <SlotHost>
        <Accordion.Panel :keep-mounted="false">content</Accordion.Panel>
      </SlotHost>
    </Accordion.Item>
  </Accordion.Root>
</template>
