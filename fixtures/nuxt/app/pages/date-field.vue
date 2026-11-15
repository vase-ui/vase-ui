<script setup lang="ts">
import { shallowRef } from 'vue';
import { DateField } from '@vase-ui/vue/date-field';
import { Field } from '@vase-ui/vue/field';

const day = shallowRef<Temporal.PlainDate | null>(Temporal.PlainDate.from('2026-11-14'));
const month = Temporal.PlainYearMonth.from('2026-11');
</script>

<template>
  <main>
    <form data-testid="form" @submit.prevent>
      <Field.Root>
        <DateField.Root v-model:value="day" name="when" locale="en-US" data-testid="when">
          <DateField.Input>
            <template #segment="{ segment }">
              <DateField.Segment
                v-if="segment.editable"
                :segment="segment"
                :data-testid="`when-${segment.type}`"
              />
              <DateField.Literal v-else :segment="segment" />
            </template>
          </DateField.Input>
          <DateField.Clear data-testid="when-clear" />
        </DateField.Root>
        <Field.Label data-testid="when-label">Date</Field.Label>
      </Field.Root>
      <output data-testid="when-value">{{ day?.toString() ?? '' }}</output>
    </form>
    <label for="card" data-testid="card-label">Card expires</label>
    <DateField.Root id="card" :default-value="month" locale="en-US" data-testid="card">
      <DateField.Input />
    </DateField.Root>
  </main>
</template>
