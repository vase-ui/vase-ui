<script setup lang="ts">
import { Accordion } from '../index';

defineProps<{ values: string[]; hiddenValue?: string | undefined }>();
</script>

<template>
  <Accordion.Root>
    <template v-for="value in values" :key="value">
      <Accordion.Item v-if="value !== hiddenValue" :value="value">
        <Accordion.Header>
          <Accordion.Trigger>{{ value }}</Accordion.Trigger>
        </Accordion.Header>
      </Accordion.Item>
    </template>
  </Accordion.Root>
</template>
