<script setup lang="ts">
import { useId } from 'vue';
import { TimeField } from '@vase-ui/vue/time-field';
import styles from './index.module.css';

const twelveId = useId();
const twentyFourId = useId();
const defaultValue = Temporal.PlainTime.from('15:04');
</script>

<template>
  <div :class="styles.Fields">
    <div :class="styles.Field">
      <label :for="twelveId" :class="styles.Label">12-hour cycle</label>
      <TimeField.Root
        :id="twelveId"
        :default-value="defaultValue"
        :hour-cycle="12"
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
    </div>
    <div :class="styles.Field">
      <label :for="twentyFourId" :class="styles.Label">24-hour cycle</label>
      <TimeField.Root
        :id="twentyFourId"
        :default-value="defaultValue"
        :hour-cycle="24"
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
    </div>
  </div>
</template>
