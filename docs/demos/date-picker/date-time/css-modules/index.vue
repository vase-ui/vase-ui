<script setup lang="ts">
import { computed, shallowRef, useId } from 'vue';
import { Calendar } from '@vase-ui/vue/calendar';
import { DateField } from '@vase-ui/vue/date-field';
import { DatePicker } from '@vase-ui/vue/date-picker';
import { TimeField } from '@vase-ui/vue/time-field';
import { TimePicker } from '@vase-ui/vue/time-picker';
import { Popover } from '@vase-ui/vue/popover';
import styles from '../../_index.module.css';

const labelId = useId();
const meetingDate = shallowRef<Temporal.PlainDate | null>(Temporal.PlainDate.from('2026-11-18'));
const meetingTime = shallowRef<Temporal.PlainTime | null>(Temporal.PlainTime.from('09:30'));
// A field has no value while one of its segments is empty.
const value = computed(() =>
  meetingDate.value && meetingTime.value
    ? meetingDate.value.toPlainDateTime(meetingTime.value)
    : null,
);
</script>

<template>
  <div role="group" :aria-labelledby="labelId" :class="styles.Field">
    <div :id="labelId" :class="styles.Label">Meeting time</div>
    <div :class="styles.Row">
      <DatePicker.Root v-model="meetingDate" locale="en-US">
        <div :class="styles.Control">
          <DatePicker.Field aria-label="Date" :class="styles.Group">
            <DateField.Input :class="styles.Input">
              <template #segment="{ segment }">
                <DateField.Segment
                  v-if="segment.editable"
                  :segment="segment"
                  :class="styles.Segment"
                />
                <DateField.Literal v-else :segment="segment" :class="styles.Literal" />
              </template>
            </DateField.Input>
          </DatePicker.Field>
          <DatePicker.Trigger aria-label="Choose date" :class="styles.Trigger">
            <svg
              aria-hidden="true"
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              stroke-linecap="square"
            >
              <rect x="2.5" y="3.5" width="11" height="10" />
              <path d="M2.5 6.5h11M5.5 2v3M10.5 2v3" />
            </svg>
          </DatePicker.Trigger>
        </div>
        <Popover.Portal>
          <DatePicker.Positioner :side-offset="4">
            <Transition
              :enter-from-class="styles.PopupHidden"
              :leave-to-class="styles.PopupHidden"
              appear
            >
              <DatePicker.Popup aria-label="Choose a meeting date" :class="styles.Popup">
                <DatePicker.Calendar :class="styles.Calendar">
                  <div :class="styles.Nav">
                    <Calendar.PreviousButton :class="styles.Button"
                      >&lsaquo;</Calendar.PreviousButton
                    >
                    <Calendar.NextButton :class="styles.Button">&rsaquo;</Calendar.NextButton>
                  </div>
                  <Calendar.Months>
                    <template #month="{ month }">
                      <Calendar.Month :month="month">
                        <Calendar.Caption :class="styles.Caption" />
                        <Calendar.Grid :class="styles.Grid">
                          <Calendar.GridHeader>
                            <Calendar.GridHeaderRow>
                              <template #weekday="{ weekday }">
                                <Calendar.Weekday :weekday="weekday" :class="styles.Weekday" />
                              </template>
                            </Calendar.GridHeaderRow>
                          </Calendar.GridHeader>
                          <Calendar.GridBody>
                            <template #week="{ week }">
                              <Calendar.Week :week="week">
                                <template #day="{ day }">
                                  <Calendar.Day :day="day" :class="styles.Day">
                                    <Calendar.DayButton :class="styles.DayButton" />
                                  </Calendar.Day>
                                </template>
                              </Calendar.Week>
                            </template>
                          </Calendar.GridBody>
                        </Calendar.Grid>
                      </Calendar.Month>
                    </template>
                  </Calendar.Months>
                </DatePicker.Calendar>
              </DatePicker.Popup>
            </Transition>
          </DatePicker.Positioner>
        </Popover.Portal>
      </DatePicker.Root>
      <TimePicker.Root v-model="meetingTime" locale="en-US" :hour-cycle="12">
        <div :class="styles.Control">
          <TimePicker.Field aria-label="Time" :class="styles.Group">
            <TimeField.Input :class="styles.Input">
              <template #segment="{ segment }">
                <TimeField.Segment
                  v-if="segment.editable"
                  :segment="segment"
                  :class="styles.Segment"
                />
                <TimeField.Literal v-else :segment="segment" :class="styles.Literal" />
              </template>
            </TimeField.Input>
          </TimePicker.Field>
          <TimePicker.Trigger aria-label="Choose time" :class="styles.Trigger">
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
            <Transition
              :enter-from-class="styles.PopupHidden"
              :leave-to-class="styles.PopupHidden"
              appear
            >
              <TimePicker.Popup aria-label="Choose a meeting time" :class="styles.Popup">
                <TimePicker.List aria-label="Times" :class="styles.List">
                  <template #item="{ time }">
                    <TimePicker.Item :time="time" :class="styles.Item" />
                  </template>
                </TimePicker.List>
              </TimePicker.Popup>
            </Transition>
          </TimePicker.Positioner>
        </Popover.Portal>
      </TimePicker.Root>
    </div>
    <p :class="styles.Value">Value: {{ value?.toString() ?? 'none' }}</p>
  </div>
</template>
