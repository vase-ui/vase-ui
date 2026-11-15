<script setup lang="ts">
import { useId } from 'vue';
import { DateField } from '@vase-ui/vue/date-field';
import styles from './index.module.css';

const id = useId();
const defaultValue = Temporal.PlainDate.from('2026-11-21');
</script>

<template>
  <div :class="styles.Field">
    <label :for="id" :class="styles.Label">Return date</label>
    <DateField.Root :id="id" locale="en-US" :default-value="defaultValue" :class="styles.Root">
      <DateField.Input :class="styles.Input">
        <template #segment="{ segment }">
          <DateField.Segment v-if="segment.editable" :segment="segment" :class="styles.Segment" />
          <DateField.Literal v-else :segment="segment" :class="styles.Literal" />
        </template>
      </DateField.Input>
      <DateField.Clear aria-label="Clear the return date" :class="styles.Clear">
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
          <path d="M1 1l8 8M9 1L1 9" stroke="currentColor" stroke-width="1.5" />
        </svg>
      </DateField.Clear>
    </DateField.Root>
  </div>
</template>
