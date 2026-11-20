<script setup lang="ts">
import { useId } from 'vue';
import { DateField } from '@vase-ui/vue/date-field';
import { DateRangePicker } from '@vase-ui/vue/date-range-picker';
import { Calendar } from '@vase-ui/vue/calendar';
import { Popover } from '@vase-ui/vue/popover';
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
        <DateRangePicker.StartField aria-label="Start date" :id="id" :class="styles.Group">
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
        <DateRangePicker.EndField aria-label="End date" :class="styles.Group">
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
        <DateRangePicker.Trigger aria-label="Choose dates" :class="styles.Trigger">
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
      <Popover.Portal>
        <DateRangePicker.Positioner :side-offset="4">
          <Transition
            :enter-from-class="styles.PopupHidden"
            :leave-to-class="styles.PopupHidden"
            appear
          >
            <DateRangePicker.Popup aria-label="Choose trip dates" :class="styles.Popup">
              <DateRangePicker.Calendar :class="styles.Calendar">
                <div :class="styles.Nav">
                  <Calendar.PreviousButton :class="styles.Button">
                    &lsaquo;
                  </Calendar.PreviousButton>
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
              </DateRangePicker.Calendar>
            </DateRangePicker.Popup>
          </Transition>
        </DateRangePicker.Positioner>
      </Popover.Portal>
    </DateRangePicker.Root>
  </div>
</template>
