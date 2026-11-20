<script setup lang="ts">
import { computed, useTemplateRef, type PropType } from 'vue';
import { Calendar } from '../../src/calendar';
import { RangeCalendar } from '../../src/range-calendar';

// Each part of Calendar in `Calendar.Root`, or in `RangeCalendar.Root` with `range`. `root` goes to
// the root, `dayButton` to each day button and `parts` to the other parts by their name, such as
// `parts.Grid`. Each day cell has `data-date`, and each button of a month cell or a year cell has
// its month or year. `captionAfter` puts the caption after the grid. `transition` puts the grid
// in a `<Transition>` of that name, with the first day of the page as its key.
const props = defineProps({
  root: Object as PropType<Record<string, unknown>>,
  range: Boolean,
  dayButton: Object as PropType<Record<string, unknown>>,
  parts: { type: Object as PropType<Record<string, Record<string, unknown>>>, default: () => ({}) },
  captionAfter: Boolean,
  weekNumbers: Boolean,
  selects: Boolean,
  views: Boolean,
  footer: Boolean,
  transition: String,
});
const rootPart = useTemplateRef('rootPart');
defineExpose({ root: rootPart });
const Root = computed(() => (props.range ? RangeCalendar.Root : Calendar.Root));
</script>

<template>
  <button id="before">Before</button>
  <component :is="Root" ref="rootPart" v-bind="root">
    <Calendar.PreviousButton v-bind="parts.PreviousButton" />
    <Calendar.NextButton v-bind="parts.NextButton" />
    <template v-if="selects">
      <Calendar.MonthSelect v-bind="parts.MonthSelect" />
      <Calendar.YearSelect v-bind="parts.YearSelect" />
    </template>
    <template v-if="views">
      <Calendar.ViewTrigger v-bind="parts.ViewTrigger" />
      <Calendar.MonthGrid v-bind="parts.MonthGrid">
        <template #row="{ months }">
          <Calendar.MonthGridRow>
            <Calendar.MonthCell
              v-for="month in months"
              :key="month.toString()"
              :month="month"
              :data-month="month.toString()"
            />
          </Calendar.MonthGridRow>
        </template>
      </Calendar.MonthGrid>
      <Calendar.YearGrid v-bind="parts.YearGrid">
        <template #row="{ years }">
          <Calendar.YearGridRow>
            <Calendar.YearCell
              v-for="year in years"
              :key="year.year"
              :year="year"
              :data-year="year.year"
            />
          </Calendar.YearGridRow>
        </template>
      </Calendar.YearGrid>
    </template>
    <Calendar.Months v-bind="parts.Months">
      <template #month="{ month }">
        <Calendar.Month :month="month" v-bind="parts.Month">
          <Calendar.Caption v-if="!captionAfter" v-bind="parts.Caption" />
          <Transition v-if="transition" :name="transition">
            <Calendar.Grid :key="month.first.toString()" v-bind="parts.Grid">
              <Calendar.GridBody>
                <template #week="{ week }">
                  <Calendar.Week :week="week">
                    <template #day="{ day }">
                      <Calendar.Day :day="day" :data-date="day.withCalendar('iso8601').toString()">
                        <Calendar.DayButton v-bind="dayButton" />
                      </Calendar.Day>
                    </template>
                  </Calendar.Week>
                </template>
              </Calendar.GridBody>
            </Calendar.Grid>
          </Transition>
          <Calendar.Grid v-else v-bind="parts.Grid">
            <Calendar.GridHeader>
              <Calendar.GridHeaderRow>
                <Calendar.WeekNumberHeader v-if="weekNumbers" />
                <template #weekday="{ weekday }">
                  <Calendar.Weekday :weekday="weekday" v-bind="parts.Weekday" />
                </template>
              </Calendar.GridHeaderRow>
            </Calendar.GridHeader>
            <Calendar.GridBody>
              <template #week="{ week }">
                <Calendar.Week :week="week">
                  <Calendar.WeekNumber v-if="weekNumbers" :week="week" />
                  <template #day="{ day }">
                    <Calendar.Day
                      :day="day"
                      :data-date="day.withCalendar('iso8601').toString()"
                      v-bind="parts.Day"
                    >
                      <Calendar.DayButton v-bind="dayButton" />
                    </Calendar.Day>
                  </template>
                </Calendar.Week>
              </template>
            </Calendar.GridBody>
          </Calendar.Grid>
          <Calendar.Caption v-if="captionAfter" v-bind="parts.Caption" />
        </Calendar.Month>
      </template>
    </Calendar.Months>
    <Calendar.Footer v-if="footer" v-bind="parts.Footer">Footer</Calendar.Footer>
  </component>
  <button id="after">After</button>
</template>

<style>
.calendar-slide-enter-active,
.calendar-slide-leave-active {
  transition: opacity 300ms linear;
}
.calendar-slide-enter-from,
.calendar-slide-leave-to {
  opacity: 0;
}
</style>
