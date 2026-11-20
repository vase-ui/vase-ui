<script setup lang="ts">
import { Calendar } from '@vase-ui/vue/calendar';
import { DateField } from '@vase-ui/vue/date-field';
import { DatePicker } from '@vase-ui/vue/date-picker';
import { Field } from '@vase-ui/vue/field';
import { Popover } from '@vase-ui/vue/popover';
import styles from '../../_index.module.css';

const defaultValue = Temporal.PlainDate.from('2026-12-01');
const minDate = Temporal.PlainDate.from('2026-11-01');
const maxDate = Temporal.PlainDate.from('2026-11-30');
// Saturday and Sunday.
const unavailableDates = { dayOfWeek: [6, 7] };

const popupHiddenClass = styles.PopupHidden;
</script>

<template>
  <Field.Root name="checkIn" :class="styles.Field">
    <Field.Label :class="styles.Label">Check-in date</Field.Label>
    <DatePicker.Root
      required
      :default-value="defaultValue"
      :min="minDate"
      :max="maxDate"
      :unavailable-dates="unavailableDates"
      locale="en-US"
    >
      <div :class="styles.Control">
        <DatePicker.Field :class="styles.Group">
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
            :enter-from-class="popupHiddenClass"
            :leave-to-class="popupHiddenClass"
            appear
          >
            <DatePicker.Popup aria-label="Choose a check-in date" :class="styles.Popup">
              <DatePicker.Calendar :class="styles.Calendar">
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
            </DatePicker.Popup>
          </Transition>
        </DatePicker.Positioner>
      </Popover.Portal>
    </DatePicker.Root>
    <Field.Description :class="styles.Description"
      >Choose a weekday in November 2026.</Field.Description
    >
    <Field.Error :class="styles.Error" />
  </Field.Root>
</template>
