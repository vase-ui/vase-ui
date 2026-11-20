---
order: 1
description: An unstyled Vue calendar component that selects a day or a month, with Temporal values.
---

<script setup lang="ts">
import ApiReference from '../.vitepress/components/ApiReference.vue';
import BaseUiDifferences from '../.vitepress/components/BaseUiDifferences.vue';
import DemoFrame from '../.vitepress/components/DemoFrame.vue';
import DemoSource from '../.vitepress/components/DemoSource.vue';
import DemoCalendarAnimation from '../demos/calendar/animation/css-modules/index.vue';
import DemoCalendarAnimationTailwind from '../demos/calendar/animation/tailwind/index.vue';
import DemoCalendarBroadcast from '../demos/calendar/broadcast/css-modules/index.vue';
import DemoCalendarBroadcastTailwind from '../demos/calendar/broadcast/tailwind/index.vue';
import DemoCalendarCalendarSystem from '../demos/calendar/calendar-system/css-modules/index.vue';
import DemoCalendarCalendarSystemTailwind from '../demos/calendar/calendar-system/tailwind/index.vue';
import DemoCalendarDisabledDates from '../demos/calendar/disabled-dates/css-modules/index.vue';
import DemoCalendarDisabledDatesTailwind from '../demos/calendar/disabled-dates/tailwind/index.vue';
import DemoCalendarHero from '../demos/calendar/hero/css-modules/index.vue';
import DemoCalendarHeroTailwind from '../demos/calendar/hero/tailwind/index.vue';
import DemoCalendarModifiers from '../demos/calendar/modifiers/css-modules/index.vue';
import DemoCalendarModifiersTailwind from '../demos/calendar/modifiers/tailwind/index.vue';
import DemoCalendarMonthPicker from '../demos/calendar/month-picker/css-modules/index.vue';
import DemoCalendarMonthPickerTailwind from '../demos/calendar/month-picker/tailwind/index.vue';
import DemoCalendarMonthYearSelect from '../demos/calendar/month-year-select/css-modules/index.vue';
import DemoCalendarMonthYearSelectTailwind from '../demos/calendar/month-year-select/tailwind/index.vue';
import DemoCalendarMultiple from '../demos/calendar/multiple/css-modules/index.vue';
import DemoCalendarMultipleTailwind from '../demos/calendar/multiple/tailwind/index.vue';
import DemoCalendarMultipleMonths from '../demos/calendar/multiple-months/css-modules/index.vue';
import DemoCalendarMultipleMonthsTailwind from '../demos/calendar/multiple-months/tailwind/index.vue';
import DemoCalendarTimeZone from '../demos/calendar/time-zone/css-modules/index.vue';
import DemoCalendarTimeZoneTailwind from '../demos/calendar/time-zone/tailwind/index.vue';
import DemoCalendarUnavailableDates from '../demos/calendar/unavailable-dates/css-modules/index.vue';
import DemoCalendarUnavailableDatesTailwind from '../demos/calendar/unavailable-dates/tailwind/index.vue';
import DemoCalendarViews from '../demos/calendar/views/css-modules/index.vue';
import DemoCalendarViewsTailwind from '../demos/calendar/views/tailwind/index.vue';
import DemoCalendarWeekNumbers from '../demos/calendar/week-numbers/css-modules/index.vue';
import DemoCalendarWeekNumbersTailwind from '../demos/calendar/week-numbers/tailwind/index.vue';
import DemoCalendarWeekView from '../demos/calendar/week-view/css-modules/index.vue';
import DemoCalendarWeekViewTailwind from '../demos/calendar/week-view/tailwind/index.vue';
</script>

# Calendar

A grid of days, months or years in which a person selects a day or a month.

<DemoFrame>
  <DemoCalendarHero />
  <template #tailwind>
    <DemoCalendarHeroTailwind />
  </template>
</DemoFrame>

<DemoSource variant="css-modules">

::: code-group

<<< ../demos/calendar/hero/css-modules/index.vue

<<< ../demos/calendar/_index.module.css

:::

</DemoSource>

<DemoSource variant="tailwind">

::: code-group

<<< ../demos/calendar/hero/tailwind/index.vue

:::

</DemoSource>

## Usage guidelines

- **Load `Temporal` first**: An engine with no `Temporal` needs a polyfill, and TypeScript before 6.0 needs `skipLibCheck`. [Dates and times](/handbook/dates-and-times) gives the steps.
- **Name the calendar**: With no name of your own, the root has the name of the page that it shows, such as `November 2026`. Give the root an `aria-label`, or an `aria-labelledby` that names a heading, to say what the date is for.
- **Describe the view trigger**: The name of `Calendar.ViewTrigger` is the page that it shows, such as `2026`. Give it an `aria-description` that says what a press does.

## Anatomy

Import the component and assemble its parts:

<<< ./calendar/Anatomy.vue

## Examples

### Months and years

`Calendar.ViewTrigger` shows the grid of years, or the grid of months with `view="month"`. A second press shows the days again. A press on a year shows the months of that year, and a press on a month shows its days.

<DemoFrame>
  <DemoCalendarViews />
  <template #tailwind>
    <DemoCalendarViewsTailwind />
  </template>
</DemoFrame>

<DemoSource variant="css-modules">

::: code-group

<<< ../demos/calendar/views/css-modules/index.vue

<<< ../demos/calendar/_index.module.css

:::

</DemoSource>

<DemoSource variant="tailwind">

::: code-group

<<< ../demos/calendar/views/tailwind/index.vue

:::

</DemoSource>

In the grid of months, the navigation buttons move one year. In the grid of years, they move one page of `visibleYears` years. A page of years starts with a multiple of `visibleYears`, so the page of 2026 has the years from 2016 to 2027.

### Month picker

A value that is a `Temporal.PlainYearMonth` makes a month picker. It shows the grid of months and no days, and a press on a month selects it. With `multiple`, a press adds or removes a month, and `minDays` and `maxDays` count months.

<DemoFrame>
  <DemoCalendarMonthPicker />
  <template #tailwind>
    <DemoCalendarMonthPickerTailwind />
  </template>
</DemoFrame>

<DemoSource variant="css-modules">

::: code-group

<<< ../demos/calendar/month-picker/css-modules/index.vue

<<< ../demos/calendar/_index.module.css

:::

</DemoSource>

<DemoSource variant="tailwind">

::: code-group

<<< ../demos/calendar/month-picker/tailwind/index.vue

:::

</DemoSource>

To start with no month, set the value to `null` and `defaultValue` to a `Temporal.PlainYearMonth`. The calendar stays a month picker when its value becomes empty.

### Multiple days

With `multiple`, a person selects a list of days, and `maxDays` limits the list. This calendar takes at most three interview days, none before today. `Calendar.Footer` is a live region for a message below the calendar. Here it counts the days.

<DemoFrame>
  <DemoCalendarMultiple />
  <template #tailwind>
    <DemoCalendarMultipleTailwind />
  </template>
</DemoFrame>

<DemoSource variant="css-modules">

::: code-group

<<< ../demos/calendar/multiple/css-modules/index.vue

<<< ../demos/calendar/_index.module.css

:::

</DemoSource>

<DemoSource variant="tailwind">

::: code-group

<<< ../demos/calendar/multiple/tailwind/index.vue

:::

</DemoSource>

### Disabled days

This calendar is for a delivery on a working day in the 8 weeks from today. `min` and `max` disable the days outside them, and the navigation buttons stop at them. `disabledDates` matches Saturday and Sunday, so the keys skip them.

<DemoFrame>
  <DemoCalendarDisabledDates />
  <template #tailwind>
    <DemoCalendarDisabledDatesTailwind />
  </template>
</DemoFrame>

<DemoSource variant="css-modules">

::: code-group

<<< ../demos/calendar/disabled-dates/css-modules/index.vue

<<< ../demos/calendar/_index.module.css

:::

</DemoSource>

<DemoSource variant="tailwind">

::: code-group

<<< ../demos/calendar/disabled-dates/tailwind/index.vue

:::

</DemoSource>

`disabledDates`, `unavailableDates`, `hiddenDates` and `modifiers` take a matcher: a day, `{ start, end }`, `{ before }`, `{ after }`, `{ dayOfWeek }`, a function, or a list of these.

### Unavailable days

Some days of this calendar are full. A day that `unavailableDates` matches stays in the sequence of the keys, and its button has `aria-disabled`. A screen reader user thus finds the day and hears that it is not available. The style sheet draws a line through the number of such a day.

<DemoFrame>
  <DemoCalendarUnavailableDates />
  <template #tailwind>
    <DemoCalendarUnavailableDatesTailwind />
  </template>
</DemoFrame>

<DemoSource variant="css-modules">

::: code-group

<<< ../demos/calendar/unavailable-dates/css-modules/index.vue

<<< ../demos/calendar/_index.module.css

:::

</DemoSource>

<DemoSource variant="tailwind">

::: code-group

<<< ../demos/calendar/unavailable-dates/tailwind/index.vue

:::

</DemoSource>

### Modifiers

`modifiers` gives a name to the days that a matcher matches, and each such day has `data-<name>`. This calendar marks the public holidays with the modifier `holiday`, and the style sheet draws a dot on a day that has `data-holiday`. A screen reader does not read the dot, so the button of such a day has the name of the holiday as its `aria-description`.

<DemoFrame>
  <DemoCalendarModifiers />
  <template #tailwind>
    <DemoCalendarModifiersTailwind />
  </template>
</DemoFrame>

<DemoSource variant="css-modules">

::: code-group

<<< ../demos/calendar/modifiers/css-modules/index.vue

<<< ../demos/calendar/_index.module.css

:::

</DemoSource>

<DemoSource variant="tailwind">

::: code-group

<<< ../demos/calendar/modifiers/tailwind/index.vue

:::

</DemoSource>

### More than one month

`numberOfMonths` shows that number of months, one after the other, and `state.multipleMonths` of the root is `true`. With `pagedNavigation`, the navigation buttons move by that number of months. Without it, they move by one month.

<DemoFrame>
  <DemoCalendarMultipleMonths />
  <template #tailwind>
    <DemoCalendarMultipleMonthsTailwind />
  </template>
</DemoFrame>

<DemoSource variant="css-modules">

::: code-group

<<< ../demos/calendar/multiple-months/css-modules/index.vue

<<< ../demos/calendar/_index.module.css

:::

</DemoSource>

<DemoSource variant="tailwind">

::: code-group

<<< ../demos/calendar/multiple-months/tailwind/index.vue

:::

</DemoSource>

### Month and year selects

This calendar is for a date of birth. `Calendar.MonthSelect` and `Calendar.YearSelect` choose the month and the year of the page, and each is a native `<select>`. The years go from the year of `min` to the year of `max`, and `order="desc"` puts the last year first.

<DemoFrame>
  <DemoCalendarMonthYearSelect />
  <template #tailwind>
    <DemoCalendarMonthYearSelectTailwind />
  </template>
</DemoFrame>

<DemoSource variant="css-modules">

::: code-group

<<< ../demos/calendar/month-year-select/css-modules/index.vue

<<< ../demos/calendar/_index.module.css

:::

</DemoSource>

<DemoSource variant="tailwind">

::: code-group

<<< ../demos/calendar/month-year-select/tailwind/index.vue

:::

</DemoSource>

### Week numbers

`Calendar.WeekNumber` shows the number of a week, and `Calendar.WeekNumberHeader` is the header of that column. The numbers follow the first day of the week and `firstWeekContainsDate`.

<DemoFrame>
  <DemoCalendarWeekNumbers />
  <template #tailwind>
    <DemoCalendarWeekNumbersTailwind />
  </template>
</DemoFrame>

<DemoSource variant="css-modules">

::: code-group

<<< ../demos/calendar/week-numbers/css-modules/index.vue

<<< ../demos/calendar/_index.module.css

:::

</DemoSource>

<DemoSource variant="tailwind">

::: code-group

<<< ../demos/calendar/week-numbers/tailwind/index.vue

:::

</DemoSource>

### Broadcast calendar

`broadcastCalendar` shows the broadcast months. A broadcast month has four or five whole weeks that start on Monday, so the grid also shows days of the months around it. The first week of a broadcast year holds January 1, so this calendar sets `firstWeekContainsDate` to `1`. Without it, the weeks have their ISO 8601 numbers.

<DemoFrame>
  <DemoCalendarBroadcast />
  <template #tailwind>
    <DemoCalendarBroadcastTailwind />
  </template>
</DemoFrame>

<DemoSource variant="css-modules">

::: code-group

<<< ../demos/calendar/broadcast/css-modules/index.vue

<<< ../demos/calendar/_index.module.css

:::

</DemoSource>

<DemoSource variant="tailwind">

::: code-group

<<< ../demos/calendar/broadcast/tailwind/index.vue

:::

</DemoSource>

### A page of weeks or days

`visibleDuration` shows one page of weeks or days in place of a month, and the navigation buttons move by that page. This calendar shows one week. `format` of `Calendar.Caption` gives the form of the first day and the last day of the page.

<DemoFrame>
  <DemoCalendarWeekView />
  <template #tailwind>
    <DemoCalendarWeekViewTailwind />
  </template>
</DemoFrame>

<DemoSource variant="css-modules">

::: code-group

<<< ../demos/calendar/week-view/css-modules/index.vue

<<< ../demos/calendar/_index.module.css

:::

</DemoSource>

<DemoSource variant="tailwind">

::: code-group

<<< ../demos/calendar/week-view/tailwind/index.vue

:::

</DemoSource>

### Time zone

The value of this calendar is a call at 09:00 in Tokyo, a `Temporal.ZonedDateTime`. A press moves the call to another day. With no `today`, the calendar reads the clock in the zone of a zoned value after the mount, so the today of this calendar is the day in Tokyo. For another zone, give `today`, such as `Temporal.Now.plainDateISO('Europe/Paris')`.

<DemoFrame>
  <DemoCalendarTimeZone />
  <template #tailwind>
    <DemoCalendarTimeZoneTailwind />
  </template>
</DemoFrame>

<DemoSource variant="css-modules">

::: code-group

<<< ../demos/calendar/time-zone/css-modules/index.vue

<<< ../demos/calendar/_index.module.css

:::

</DemoSource>

<DemoSource variant="tailwind">

::: code-group

<<< ../demos/calendar/time-zone/tailwind/index.vue

:::

</DemoSource>

### Another calendar

`calendar` shows the dates in another calendar, such as `persian`, and the value keeps its own calendar. This calendar shows Persian months, and its value is an ISO date. With no `calendar`, the grid shows the calendar of a value that is not ISO, else the Gregorian calendar.

<DemoFrame>
  <DemoCalendarCalendarSystem />
  <template #tailwind>
    <DemoCalendarCalendarSystemTailwind />
  </template>
</DemoFrame>

<DemoSource variant="css-modules">

::: code-group

<<< ../demos/calendar/calendar-system/css-modules/index.vue

<<< ../demos/calendar/_index.module.css

:::

</DemoSource>

<DemoSource variant="tailwind">

::: code-group

<<< ../demos/calendar/calendar-system/tailwind/index.vue

:::

</DemoSource>

### Animate the page

Put `Calendar.Grid` in a `<Transition>`, with the first day of the month as its key. The grid that leaves is `inert`. `data-navigation-direction` of the root and of `Calendar.Months` gives the side of the move: `previous`, `next` or `none`. This calendar fades each grid and moves it 0.5rem, to the left for `next` and to the right for `previous`. The caption stays, and its live region reads the new month. `fixedWeeks` and `showOutsideDays` give each page six rows of buttons, so the grid keeps its height. The style sheet has no transition for a person who prefers reduced motion.

<DemoFrame>
  <DemoCalendarAnimation />
  <template #tailwind>
    <DemoCalendarAnimationTailwind />
  </template>
</DemoFrame>

<DemoSource variant="css-modules">

::: code-group

<<< ../demos/calendar/animation/css-modules/index.vue

<<< ../demos/calendar/_index.module.css

:::

</DemoSource>

<DemoSource variant="tailwind">

::: code-group

<<< ../demos/calendar/animation/tailwind/index.vue

:::

</DemoSource>

### Render on the server

No render reads the clock or the locale of the visitor. Give `locale` or a `LocaleProvider`, or the text is `en-US`. With no `today`, the root reads the clock after the mount, so the server HTML marks no day as today. With no value, `month`, `defaultMonth` or focused day, the server HTML also has no month, and the page of today comes after the mount. Give `defaultMonth`, or keep the room of the month in CSS. A server that knows the day of the visitor gives `today`. An expression of `Temporal.Now` in a template can give another day in the browser.

A server and a browser can write other names of the days and another form of a date. The hydration writes the text of the browser in `Calendar.Weekday`, `Calendar.Caption` and `Calendar.ViewTrigger` with no message. Vue allows another text only in an element whose one child is that text. With `as` or a default slot, put the text in an element of the default slot. In another part, also give that element `data-allow-mismatch="text"`. A name in an `aria-*` attribute keeps the text of the server until the part renders again.

## Keyboard

| Key                            | Action                                                                                                                                                                         |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Tab                            | Moves the focus to the one tab stop of the grid: the focused day, month or year, else the first selected one, else today, else the first one that can take the focus.          |
| Left Arrow, Right Arrow        | Moves the focus to the day, the month or the year before or after. The two keys swap in a right-to-left document.                                                              |
| Up Arrow, Down Arrow           | Moves the focus to the same day of the week before or after, or `columns` cells before or after in a grid of months or years.                                                  |
| Home, End                      | Moves the focus to the first or the last day of the week, or to the first or the last cell of the row.                                                                         |
| Page Up, Page Down             | Moves the focus to the same day of the month before or after. In the grid of months, it moves a year. In the grid of years, it moves `visibleYears` years.                     |
| Shift+Page Up, Shift+Page Down | Moves the focus to the same day a year before or after. It does nothing in a grid of months or years.                                                                          |
| Shift+Left, Shift+Right        | Moves the focus to the same day a month before or after. With `multiple`, it moves one day and adds that day to the selection. It does nothing in a grid of months or years.   |
| Shift+Up, Shift+Down           | Moves the focus to the same day a year before or after. With `multiple`, it moves one week and adds that day to the selection. It does nothing in a grid of months or years.   |
| Enter, Space                   | Selects the day, or the month of a month picker. In the grid of years, shows the months of the year. In the grid of months of a calendar of days, shows the days of the month. |

## API reference

<ApiReference />

### Calendar.Root.ChangeEventReason

The `reason` of the details of a change event: `month-change` is a navigation button or a select, and `none` is a focus.

<ApiReference name="Calendar.Root.ChangeEventReason" />

### Calendar.Root.View

What the grid shows: the days, the months of a year, or a page of years.

<ApiReference name="Calendar.Root.View" />

## Differences from Base UI

<BaseUiDifferences />
