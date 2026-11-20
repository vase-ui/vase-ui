<script setup lang="ts">
import { useId } from 'vue';
import { TimeField } from '@vase-ui/vue/time-field';

const twelveId = useId();
const twentyFourId = useId();
const defaultValue = Temporal.PlainTime.from('15:04');
</script>

<template>
  <div class="flex flex-wrap gap-6">
    <div class="flex flex-col items-start gap-1">
      <label :for="twelveId" class="text-sm font-bold text-neutral-950 dark:text-white"
        >12-hour cycle</label
      >
      <TimeField.Root
        :id="twelveId"
        :default-value="defaultValue"
        :hour-cycle="12"
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
    </div>
    <div class="flex flex-col items-start gap-1">
      <label :for="twentyFourId" class="text-sm font-bold text-neutral-950 dark:text-white"
        >24-hour cycle</label
      >
      <TimeField.Root
        :id="twentyFourId"
        :default-value="defaultValue"
        :hour-cycle="24"
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
    </div>
  </div>
</template>
