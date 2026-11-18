<!-- @strictTemplates true -->
<script setup lang="ts">
import { shallowRef } from 'vue';
import { expectType } from '#test-utils';
import { DateField } from '@vase-ui/vue/date-field';

const day = shallowRef<Temporal.PlainDate | null>(null);
const zoned = shallowRef<Temporal.ZonedDateTime | null>(null);

function onDayChange(value: Temporal.PlainDate | null, details: DateField.Root.ChangeEventDetails) {
  return String(value) + details.reason;
}

function onWrongKind(value: Temporal.PlainTime | null) {
  return String(value);
}
</script>

<template>
  <!-- `v-model` gives back the kind of the value that the parent gave. -->
  <DateField.Root v-model="day" />
  <DateField.Root v-model="zoned" />
  <!-- @vue-expect-error a zoned value does not fit a ref of a date -->
  <DateField.Root
    v-model="day"
    :default-value="Temporal.ZonedDateTime.from('2026-11-14T15:04[UTC]')"
  />

  <DateField.Root :model-value="day" @value-change="onDayChange" />
  <DateField.Root
    :model-value="day"
    @value-change="
      (value) => {
        expectType<Temporal.PlainDate | null, typeof value>(value);
      }
    "
  />
  <!-- @vue-expect-error the field gives a date, and a time does not fit it -->
  <DateField.Root :model-value="day" @value-change="onWrongKind" />

  <!-- The slot narrows the part of the layout, so that each part gets what it needs. -->
  <DateField.Root>
    <DateField.Input>
      <template #segment="{ segment, index }">
        <DateField.Segment v-if="segment.editable" :segment="segment" :key="index" />
        <DateField.Literal v-else :segment="segment" />
      </template>
    </DateField.Input>
  </DateField.Root>
  <DateField.Root>
    <DateField.Input>
      <template #segment="{ segment }">
        <!-- @vue-expect-error a separator is not a segment that the user edits -->
        <DateField.Segment :segment="segment" />
      </template>
    </DateField.Input>
  </DateField.Root>
</template>
