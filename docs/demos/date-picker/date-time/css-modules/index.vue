<script setup lang="ts">
import { useId } from 'vue';
import { Calendar } from '@vase-ui/vue/calendar';
import { DateField } from '@vase-ui/vue/date-field';
import { DatePicker } from '@vase-ui/vue/date-picker';
import { TimeField } from '@vase-ui/vue/time-field';
import styles from '../../_index.module.css';

const id = useId();
const today = Temporal.PlainDate.from('2026-11-14');
const defaultValue = Temporal.PlainDateTime.from('2026-11-18T09:30');
</script>

<template>
  <div :class="styles.Field">
    <label :for="id" :class="styles.Label">Meeting time</label>
    <DatePicker.Root :default-value="defaultValue" locale="en-US" time-zone="UTC">
      <div :class="styles.Control">
        <DatePicker.Field :id="id" :class="styles.Group">
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
        <DatePicker.Trigger :class="styles.Trigger">
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
      <DatePicker.Portal>
        <DatePicker.Positioner :side-offset="4">
          <DatePicker.Popup aria-label="Choose a meeting time" :class="styles.Popup">
            <DatePicker.Calendar :today="today" :class="styles.Calendar">
              <div :class="styles.Nav">
                <Calendar.PreviousButton :class="styles.Button">&lsaquo;</Calendar.PreviousButton>
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
            <DatePicker.TimeField aria-label="Time" :class="styles.TimeField">
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
            </DatePicker.TimeField>
            <DatePicker.Close :class="styles.Close">Done</DatePicker.Close>
          </DatePicker.Popup>
        </DatePicker.Positioner>
      </DatePicker.Portal>
    </DatePicker.Root>
  </div>
</template>
