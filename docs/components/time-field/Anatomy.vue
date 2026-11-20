<script setup lang="ts">
import { TimeField } from '@vase-ui/vue/time-field';
</script>

<template>
  <TimeField.Root>
    <TimeField.Input>
      <template #segment="{ segment }">
        <TimeField.Segment v-if="segment.editable" :segment="segment" />
        <TimeField.Literal v-else :segment="segment" />
      </template>
    </TimeField.Input>
    <TimeField.Clear aria-label="Clear the time">×</TimeField.Clear>
  </TimeField.Root>
</template>
