<script setup lang="ts">
import { useId } from 'vue';
import { Calendar } from '@vase-ui/vue/calendar';
import { DateField } from '@vase-ui/vue/date-field';
import { DatePicker } from '@vase-ui/vue/date-picker';
import { Popover } from '@vase-ui/vue/popover';
import styles from '../../_index.module.css';

const id = useId();
const defaultValue = Temporal.PlainYearMonth.from('2026-11');

const popupHiddenClass = styles.PopupHidden;
</script>

<template>
  <div :class="styles.Field">
    <label :for="id" :class="styles.Label">Billing month</label>
    <DatePicker.Root :default-value="defaultValue" locale="en-US">
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
        <DatePicker.Trigger aria-label="Choose month" :class="styles.Trigger">
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
          <Transition :enter-from-class="popupHiddenClass" :leave-to-class="popupHiddenClass">
            <DatePicker.Popup aria-label="Choose a billing month" :class="styles.Popup">
              <DatePicker.Calendar :class="styles.Calendar">
                <div :class="styles.Header">
                  <Calendar.PreviousButton :class="styles.Button">&lsaquo;</Calendar.PreviousButton>
                  <Calendar.ViewTrigger :class="styles.Title" />
                  <Calendar.NextButton :class="styles.Button">&rsaquo;</Calendar.NextButton>
                </div>
                <Calendar.MonthGrid :class="styles.MonthGrid">
                  <template #row="{ months }">
                    <Calendar.MonthGridRow :class="styles.MonthRow">
                      <Calendar.MonthCell
                        v-for="month in months"
                        :key="month.toString()"
                        :month="month"
                        :class="styles.MonthCell"
                      />
                    </Calendar.MonthGridRow>
                  </template>
                </Calendar.MonthGrid>
                <Calendar.YearGrid :class="styles.MonthGrid">
                  <template #row="{ years }">
                    <Calendar.YearGridRow :class="styles.MonthRow">
                      <Calendar.YearCell
                        v-for="year in years"
                        :key="year.toString()"
                        :year="year"
                        :class="styles.MonthCell"
                      />
                    </Calendar.YearGridRow>
                  </template>
                </Calendar.YearGrid>
              </DatePicker.Calendar>
            </DatePicker.Popup>
          </Transition>
        </DatePicker.Positioner>
      </Popover.Portal>
    </DatePicker.Root>
  </div>
</template>
