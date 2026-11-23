<script setup lang="ts">
import { useId } from 'vue';
import { TimeField } from '@vase-ui/vue/time-field';
import { TimePicker } from '@vase-ui/vue/time-picker';
import { Popover } from '@vase-ui/vue/popover';

const id = useId();
const defaultValue = Temporal.PlainTime.from('14:30');

const popupHiddenClass = 'scale-[0.98] opacity-0';
</script>

<template>
  <div class="flex flex-col items-start gap-1">
    <label :for="id" class="text-sm font-bold text-neutral-950 dark:text-white">Start time</label>
    <TimePicker.Root :default-value="defaultValue" locale="en-US" :hour-cycle="12">
      <div
        class="box-border flex h-8 items-center border border-neutral-950 bg-white text-neutral-950 focus-within:outline-2 focus-within:-outline-offset-1 focus-within:outline-neutral-950 dark:border-white dark:bg-neutral-950 dark:text-white dark:focus-within:outline-white"
      >
        <TimePicker.Field :id="id" class="flex items-center px-2">
          <TimeField.Input
            class="flex items-center text-sm font-normal tabular-nums any-pointer-coarse:text-base"
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
        </TimePicker.Field>
        <TimePicker.Trigger
          aria-label="Choose time"
          class="box-border flex h-full w-[1.875rem] items-center justify-center border-0 border-l border-neutral-950 bg-transparent p-0 select-none hover:not-disabled:bg-neutral-100 disabled:text-neutral-500 aria-expanded:bg-neutral-100 focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-neutral-950 dark:border-white dark:hover:not-disabled:bg-neutral-800 dark:disabled:text-neutral-400 dark:aria-expanded:bg-neutral-800 dark:focus-visible:outline-white"
        >
          <svg
            aria-hidden="true"
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            stroke-linecap="square"
          >
            <circle cx="8" cy="8" r="5.5" />
            <path d="M8 4.5V8l2.5 1.5" />
          </svg>
        </TimePicker.Trigger>
      </div>
      <Popover.Portal>
        <TimePicker.Positioner :side-offset="4">
          <Transition :enter-from-class="popupHiddenClass" :leave-to-class="popupHiddenClass">
            <TimePicker.Popup
              aria-label="Choose a start time"
              class="box-border flex origin-[var(--transform-origin)] flex-col gap-3 border border-neutral-950 bg-white p-3 text-neutral-950 shadow-[0.25rem_0.25rem_0] shadow-black/12 outline-none transition-[scale,opacity] duration-100 ease-out dark:border-white dark:bg-neutral-950 dark:text-white dark:shadow-none"
            >
              <div class="flex gap-2">
                <TimePicker.Column
                  unit="hour"
                  class="box-border flex flex-col gap-0.5 overflow-y-auto text-sm tabular-nums max-h-56 w-14"
                >
                  <template #item="{ value }">
                    <TimePicker.ColumnItem
                      :value="value"
                      class="border-0 bg-transparent box-border flex h-8 flex-none cursor-pointer items-center justify-center rounded-md px-3 whitespace-nowrap select-none hover:not-disabled:not-aria-selected:bg-neutral-100 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-neutral-950 disabled:cursor-default disabled:opacity-40 aria-selected:bg-neutral-950 aria-selected:text-white aria-selected:focus-visible:outline-white dark:hover:not-disabled:not-aria-selected:bg-neutral-800 dark:focus-visible:outline-white dark:aria-selected:bg-white dark:aria-selected:text-neutral-950 dark:aria-selected:focus-visible:outline-neutral-950"
                    />
                  </template>
                </TimePicker.Column>
                <TimePicker.Column
                  unit="minute"
                  :step="5"
                  class="box-border flex flex-col gap-0.5 overflow-y-auto text-sm tabular-nums max-h-56 w-14"
                >
                  <template #item="{ value }">
                    <TimePicker.ColumnItem
                      :value="value"
                      class="border-0 bg-transparent box-border flex h-8 flex-none cursor-pointer items-center justify-center rounded-md px-3 whitespace-nowrap select-none hover:not-disabled:not-aria-selected:bg-neutral-100 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-neutral-950 disabled:cursor-default disabled:opacity-40 aria-selected:bg-neutral-950 aria-selected:text-white aria-selected:focus-visible:outline-white dark:hover:not-disabled:not-aria-selected:bg-neutral-800 dark:focus-visible:outline-white dark:aria-selected:bg-white dark:aria-selected:text-neutral-950 dark:aria-selected:focus-visible:outline-neutral-950"
                    />
                  </template>
                </TimePicker.Column>
                <TimePicker.Column
                  unit="dayPeriod"
                  class="box-border flex flex-col gap-0.5 overflow-y-auto text-sm tabular-nums max-h-56 w-14"
                >
                  <template #item="{ value }">
                    <TimePicker.ColumnItem
                      :value="value"
                      class="border-0 bg-transparent box-border flex h-8 flex-none cursor-pointer items-center justify-center rounded-md px-3 whitespace-nowrap select-none hover:not-disabled:not-aria-selected:bg-neutral-100 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-neutral-950 disabled:cursor-default disabled:opacity-40 aria-selected:bg-neutral-950 aria-selected:text-white aria-selected:focus-visible:outline-white dark:hover:not-disabled:not-aria-selected:bg-neutral-800 dark:focus-visible:outline-white dark:aria-selected:bg-white dark:aria-selected:text-neutral-950 dark:aria-selected:focus-visible:outline-neutral-950"
                    />
                  </template>
                </TimePicker.Column>
              </div>
            </TimePicker.Popup>
          </Transition>
        </TimePicker.Positioner>
      </Popover.Portal>
    </TimePicker.Root>
  </div>
</template>
