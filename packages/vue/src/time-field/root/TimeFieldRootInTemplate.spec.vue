<!-- @strictTemplates true -->
<script setup lang="ts">
import { shallowRef } from 'vue';
import { expectType } from '#test-utils';
import { TimeField } from '@vase-ui/vue/time-field';

const id = 'id';
const time = shallowRef<Temporal.PlainTime | null>(null);
const zoned = shallowRef<Temporal.ZonedDateTime | null>(null);

function onTimeChange(
  value: Temporal.PlainTime | null,
  details: TimeField.Root.ChangeEventDetails,
) {
  return String(value) + details.reason;
}

function onWrongKind(value: Temporal.PlainDate | null) {
  return String(value);
}
</script>

<template>
  <!-- `v-model:value` gives back the kind of the value that the parent gave. -->
  <TimeField.Root v-model:value="time" />
  <TimeField.Root v-model:value="zoned" />
  <!-- @vue-expect-error a zoned value does not fit a ref of a time -->
  <TimeField.Root
    v-model:value="time"
    :default-value="Temporal.ZonedDateTime.from('2026-11-14T15:04[UTC]')"
  />

  <TimeField.Root :value="time" @value-change="onTimeChange" />
  <TimeField.Root
    :value="time"
    @value-change="
      (value) => {
        expectType<Temporal.PlainTime | null, typeof value>(value);
      }
    "
  />
  <!-- @vue-expect-error the field gives a time, and a date does not fit it -->
  <TimeField.Root :value="time" @value-change="onWrongKind" />

  <TimeField.Root aria-labelledby="id" />
  <TimeField.Root :aria-labelledby="id" />
  <TimeField.Root ariaLabelledby="id" />
  <TimeField.Root :ariaLabelledby="id" />
  <!-- @vue-expect-error `aria-labelledby` is a string -->
  <TimeField.Root :aria-labelledby="5" />

  <!-- The slot narrows the part of the layout, so that each part gets what it needs. -->
  <TimeField.Root>
    <TimeField.Input>
      <template #segment="{ segment, index }">
        <TimeField.Segment v-if="segment.editable" :segment="segment" :key="index" />
        <TimeField.Literal v-else :segment="segment" />
      </template>
    </TimeField.Input>
  </TimeField.Root>
  <TimeField.Root>
    <TimeField.Input>
      <template #segment="{ segment }">
        <!-- @vue-expect-error a separator is not a segment that the user edits -->
        <TimeField.Segment :segment="segment" />
      </template>
    </TimeField.Input>
  </TimeField.Root>
</template>
