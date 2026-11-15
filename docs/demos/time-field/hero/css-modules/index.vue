<script setup lang="ts">
import { useId } from 'vue';
import { TimeField } from '@vase-ui/vue/time-field';
import styles from './index.module.css';

const id = useId();
</script>

<template>
  <div :class="styles.Field">
    <label :for="id" :class="styles.Label">Alarm</label>
    <TimeField.Root :id="id" locale="en-US" :class="styles.Root">
      <TimeField.Input :class="styles.Input">
        <template #segment="{ segment }">
          <TimeField.Segment v-if="segment.editable" :segment="segment" :class="styles.Segment" />
          <TimeField.Literal v-else :segment="segment" :class="styles.Literal" />
        </template>
      </TimeField.Input>
    </TimeField.Root>
  </div>
</template>
