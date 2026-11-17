<script setup lang="ts">
import { useId } from 'vue';
import { DateField } from '@vase-ui/vue/date-field';
import { DateRangePicker } from '@vase-ui/vue/date-range-picker';
import { RangeCalendar } from '@vase-ui/vue/range-calendar';
import styles from '../../_index.module.css';

const id = useId();
const defaultValue: [Temporal.PlainDate, Temporal.PlainDate] = [
  Temporal.PlainDate.from('2026-11-18'),
  Temporal.PlainDate.from('2026-11-22'),
];
</script>

<template>
  <div :class="styles.Field">
    <label :for="id" :class="styles.Label">Trip dates</label>
    <DateRangePicker.Root :default-value="defaultValue" locale="en-US">
      <div :class="styles.Control">
        <DateRangePicker.StartField :id="id" :class="styles.Group">
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
        </DateRangePicker.StartField>
        <span aria-hidden="true" :class="styles.Separator">&ndash;</span>
        <DateRangePicker.EndField :class="styles.Group">
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
        </DateRangePicker.EndField>
        <DateRangePicker.Trigger :class="styles.Trigger">
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
        </DateRangePicker.Trigger>
      </div>
      <DateRangePicker.Portal>
        <DateRangePicker.Positioner :side-offset="4">
          <DateRangePicker.Popup aria-label="Choose trip dates" :class="styles.Popup">
            <DateRangePicker.Calendar :class="styles.Calendar">
              <div :class="styles.Nav">
                <RangeCalendar.PreviousButton :class="styles.Button">
                  &lsaquo;
                </RangeCalendar.PreviousButton>
                <RangeCalendar.NextButton :class="styles.Button">&rsaquo;</RangeCalendar.NextButton>
              </div>
              <RangeCalendar.Months>
                <template #month="{ month }">
                  <RangeCalendar.Month :month="month">
                    <RangeCalendar.Caption :class="styles.Caption" />
                    <RangeCalendar.Grid :class="styles.Grid">
                      <RangeCalendar.GridHeader>
                        <RangeCalendar.GridHeaderRow>
                          <template #weekday="{ weekday }">
                            <RangeCalendar.Weekday :weekday="weekday" :class="styles.Weekday" />
                          </template>
                        </RangeCalendar.GridHeaderRow>
                      </RangeCalendar.GridHeader>
                      <RangeCalendar.GridBody>
                        <template #week="{ week }">
                          <RangeCalendar.Week :week="week">
                            <template #day="{ day }">
                              <RangeCalendar.Day :day="day" :class="styles.Day">
                                <RangeCalendar.DayButton :class="styles.DayButton" />
                              </RangeCalendar.Day>
                            </template>
                          </RangeCalendar.Week>
                        </template>
                      </RangeCalendar.GridBody>
                    </RangeCalendar.Grid>
                  </RangeCalendar.Month>
                </template>
              </RangeCalendar.Months>
            </DateRangePicker.Calendar>
          </DateRangePicker.Popup>
        </DateRangePicker.Positioner>
      </DateRangePicker.Portal>
    </DateRangePicker.Root>
  </div>
</template>
