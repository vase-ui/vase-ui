<script setup lang="ts">
import { shallowRef, useId } from 'vue';
import { TimeField } from '@vase-ui/vue/time-field';
import styles from './index.module.css';

const id = useId();
const value = shallowRef<Temporal.PlainTime | null>(Temporal.PlainTime.from('07:30:00'));
</script>

<template>
  <div :class="styles.Field">
    <label :for="id" :class="styles.Label">Lap time</label>
    <TimeField.Root
      :id="id"
      v-model:value="value"
      granularity="second"
      locale="en-US"
      :class="styles.Root"
    >
      <TimeField.Input :class="styles.Input">
        <template #segment="{ segment }">
          <TimeField.Segment v-if="segment.editable" :segment="segment" :class="styles.Segment" />
          <TimeField.Literal v-else :segment="segment" :class="styles.Literal" />
        </template>
      </TimeField.Input>
    </TimeField.Root>
    <p :class="styles.Value">Value: {{ value?.toString() ?? 'none' }}</p>
  </div>
</template>
