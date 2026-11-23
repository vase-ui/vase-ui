<script setup lang="ts">
import 'temporal-polyfill/global';
import { DateField } from '@vase-ui/vue/date-field';
import { computed, shallowRef, useId } from 'vue';
import '../../../behavior/style.css';

const id = useId();
const value = shallowRef<Temporal.PlainDate | null>(Temporal.PlainDate.from('2026-01-15'));
// A Temporal value names its type in `Symbol.toStringTag`, such as `Temporal.PlainDate`.
const valueType = computed(() => Object.prototype.toString.call(value.value).slice(8, -1));
</script>

<template>
  <form class="bench-page">
    <label :for="id">Date</label>
    <DateField.Root :id="id" v-model="value" data-bench="date-field" name="date" locale="en-US">
      <DateField.Input>
        <template #segment="{ segment }">
          <DateField.Segment v-if="segment.editable" :segment="segment" />
          <DateField.Literal v-else :segment="segment" />
        </template>
      </DateField.Input>
    </DateField.Root>
    <output data-bench="value">{{ String(value) }}</output>
    <output data-bench="value-type">{{ valueType }}</output>
  </form>
</template>
