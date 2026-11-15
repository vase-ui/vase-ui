<script setup lang="ts">
import { useId } from 'vue';
import { DateField } from '@vase-ui/vue/date-field';
import styles from './index.module.css';

const id = useId();
</script>

<template>
  <div :class="styles.Field">
    <label :for="id" :class="styles.Label">Departure date</label>
    <DateField.Root :id="id" locale="en-US" :class="styles.Root">
      <DateField.Input :class="styles.Input">
        <template #segment="{ segment }">
          <DateField.Segment v-if="segment.editable" :segment="segment" :class="styles.Segment" />
          <DateField.Literal v-else :segment="segment" :class="styles.Literal" />
        </template>
      </DateField.Input>
    </DateField.Root>
  </div>
</template>
