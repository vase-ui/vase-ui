<script setup lang="ts">
import { DateInput, useDateInput } from '@ark-ui/vue/date-input';
import { DateFormatter, parseZonedDateTime } from '@internationalized/date';
import '../../../behavior/style.css';

const timeZone = 'America/New_York';
// The formatter of the docs shows the time in the zone of the runtime. It takes the zone of the
// value here, as the docs give the same zone to the formatter and to `timeZone`.
const timeFormatter = new DateFormatter('en-US', {
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
  timeZone,
});
const dateInput = useDateInput({
  defaultValue: [parseZonedDateTime(`2026-03-08T01:30[${timeZone}]`)],
  granularity: 'minute',
  hourCycle: 24,
  formatter: timeFormatter,
  timeZone,
});
</script>

<template>
  <div class="bench-page">
    <DateInput.RootProvider :value="dateInput" data-bench="time-field">
      <DateInput.Label>Time</DateInput.Label>
      <DateInput.Control>
        <DateInput.SegmentGroup>
          <DateInput.SegmentContext v-slot="segment">
            <DateInput.Segment :segment="segment" />
          </DateInput.SegmentContext>
        </DateInput.SegmentGroup>
      </DateInput.Control>
      <DateInput.HiddenInput />
    </DateInput.RootProvider>
    <output data-bench="instant">{{ dateInput.valueAsDate[0]?.getTime() }}</output>
  </div>
</template>
