<script setup lang="ts">
import { shallowRef, useId } from 'vue';
import { DateField } from '@vase-ui/vue/date-field';
import styles from './index.module.css';

const id = useId();
const value = shallowRef<Temporal.ZonedDateTime | null>(
  Temporal.ZonedDateTime.from('2026-11-14T15:04[Asia/Tokyo]'),
);
</script>

<template>
  <div :class="styles.Field">
    <label :for="id" :class="styles.Label">Flight departs</label>
    <DateField.Root :id="id" v-model="value" locale="en-US" :class="styles.Root">
      <DateField.Input :class="styles.Input">
        <template #segment="{ segment }">
          <DateField.Segment v-if="segment.editable" :segment="segment" :class="styles.Segment" />
          <DateField.Literal v-else :segment="segment" :class="styles.Literal" />
        </template>
      </DateField.Input>
    </DateField.Root>
    <p :class="styles.Value">Value: {{ value?.toString() ?? 'none' }}</p>
  </div>
</template>
