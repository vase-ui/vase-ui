<script setup lang="ts">
import CalendarNavigationAnatomy from './CalendarNavigationAnatomy.test.vue';

// A server render takes its props as JSON, so each date is a text that this fixture reads.
const props = withDefaults(
  defineProps<{
    today?: string | undefined;
    value?: string | undefined;
    minDate?: string | undefined;
    maxDate?: string | undefined;
    locale?: string | undefined;
    calendar?: string | undefined;
    numberOfMonths?: number | undefined;
    pagedNavigation?: boolean | undefined;
    fixedWeeks?: boolean | undefined;
    showOutsideDays?: boolean | undefined;
    isoWeek?: boolean | undefined;
    broadcastCalendar?: boolean | undefined;
    // `weeks:2` or `days:5`.
    duration?: string | undefined;
    weekNumbers?: boolean | undefined;
    selects?: boolean | undefined;
    footer?: string | undefined;
  }>(),
  { showOutsideDays: undefined },
);

const date = (text: string | undefined) =>
  text === undefined ? undefined : Temporal.PlainDate.from(text);

function getDuration() {
  const [unit, count] = props.duration?.split(':') ?? [];
  return unit === 'weeks'
    ? { weeks: Number(count) }
    : unit === 'days'
      ? { days: Number(count) }
      : undefined;
}
</script>

<template>
  <CalendarNavigationAnatomy
    :today="date(props.today)"
    :value="date(props.value)"
    :min-date="date(props.minDate)"
    :max-date="date(props.maxDate)"
    :locale="props.locale"
    :calendar="props.calendar"
    :number-of-months="props.numberOfMonths"
    :paged-navigation="props.pagedNavigation"
    :fixed-weeks="props.fixedWeeks"
    :show-outside-days="props.showOutsideDays"
    :iso-week="props.isoWeek"
    :broadcast-calendar="props.broadcastCalendar"
    :visible-duration="getDuration()"
    :week-numbers="props.weekNumbers"
    :selects="props.selects"
    :footer="props.footer"
  />
</template>
