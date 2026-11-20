<script setup lang="ts">
import { shallowRef, useId } from 'vue';
import { TimeField } from '@vase-ui/vue/time-field';

const id = useId();
const value = shallowRef<Temporal.PlainTime | null>(Temporal.PlainTime.from('07:30:00'));
</script>

<template>
  <div class="flex flex-col items-start gap-1">
    <label :for="id" class="text-sm font-bold text-neutral-950 dark:text-white">Lap time</label>
    <TimeField.Root
      :id="id"
      v-model="value"
      granularity="second"
      locale="en-US"
      class="flex items-center"
    >
      <TimeField.Input
        class="flex h-8 items-center border border-neutral-950 bg-white px-2 text-sm font-normal text-neutral-950 tabular-nums any-pointer-coarse:text-base focus-within:outline-2 focus-within:-outline-offset-1 focus-within:outline-neutral-950 dark:border-white dark:bg-neutral-950 dark:text-white dark:focus-within:outline-white"
      >
        <template #segment="{ segment }">
          <TimeField.Segment
            v-if="segment.editable"
            :segment="segment"
            class="field-sizing-content px-0.5 text-center caret-transparent outline-0 placeholder:text-neutral-500 focus:bg-neutral-950 focus:text-white focus:placeholder:text-neutral-400 dark:placeholder:text-neutral-400 dark:focus:bg-white dark:focus:text-neutral-950 dark:focus:placeholder:text-neutral-600"
          />
          <TimeField.Literal
            v-else
            :segment="segment"
            class="whitespace-pre text-neutral-600 dark:text-neutral-400"
          />
        </template>
      </TimeField.Input>
    </TimeField.Root>
    <p class="text-sm text-neutral-600 dark:text-neutral-400">
      Value: {{ value?.toString() ?? 'none' }}
    </p>
  </div>
</template>
