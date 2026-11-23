<script setup lang="ts">
import { TimePicker } from '@vuetify/v0';
import { shallowRef } from 'vue';
import '../../../behavior/style.css';

// The value of TimePicker is a 24-hour text with no date and no time zone, so the fixture has no
// output `instant`.
const value = shallowRef<string | null>('01:30');
</script>

<template>
  <div class="bench-page">
    <TimePicker.Root v-model="value" data-bench="time-field">
      <TimePicker.Hour v-slot="{ text }">{{ text || '—' }}</TimePicker.Hour>
      <span aria-hidden="true">:</span>
      <TimePicker.Minute v-slot="{ text }">{{ text || '—' }}</TimePicker.Minute>
    </TimePicker.Root>
  </div>
</template>
