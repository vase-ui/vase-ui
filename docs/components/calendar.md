---
order: 1
description: An unstyled Vue calendar for days, months and years, on the Temporal API.
---

<script setup lang="ts">
import ApiReference from '../.vitepress/components/ApiReference.vue';
import DemoFrame from '../.vitepress/components/DemoFrame.vue';
import DemoSource from '../.vitepress/components/DemoSource.vue';
import DemoCalendarHero from '../demos/calendar/hero/css-modules/index.vue';
import DemoCalendarHeroTailwind from '../demos/calendar/hero/tailwind/index.vue';
import DemoCalendarMonthPicker from '../demos/calendar/month-picker/css-modules/index.vue';
import DemoCalendarMonthPickerTailwind from '../demos/calendar/month-picker/tailwind/index.vue';
import DemoCalendarViews from '../demos/calendar/views/css-modules/index.vue';
import DemoCalendarViewsTailwind from '../demos/calendar/views/tailwind/index.vue';
</script>

# Calendar

A calendar shows the days of a month, the months of a year, or a page of years. A person selects a day or a month in it.

Base UI has no calendar. This one follows the [Date Picker Dialog pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/examples/datepicker-dialog/) of the WAI-ARIA Authoring Practices Guide. Its types need TypeScript 6.0, or `skipLibCheck`. The [dates and times guide](/handbook/dates-and-times) has the details, and the polyfill for an engine with no `Temporal`.

<DemoFrame>
  <DemoCalendarHero />
  <template #tailwind>
    <DemoCalendarHeroTailwind />
  </template>
</DemoFrame>

<DemoSource variant="css-modules">

::: code-group

<<< ../demos/calendar/hero/css-modules/index.vue

<<< ../demos/calendar/hero/css-modules/index.module.css

:::

</DemoSource>

<DemoSource variant="tailwind">

::: code-group

<<< ../demos/calendar/hero/tailwind/index.vue

:::

</DemoSource>

## Anatomy

Import the component and assemble its parts:

<<< ./calendar/Anatomy.vue

`Calendar.Months`, `Calendar.MonthGrid` and `Calendar.YearGrid` each show in one view only. The view `day` shows the days, the view `month` the months of a year, and the view `year` a page of years. Each list part has a slot with the name of its item: `#month`, `#weekday`, `#week`, `#day` and `#row`. A part gets its item as a prop.

## Value

The value is a `Temporal` object, and `v-model:value` gives back the same kind. A new value has the kind, the calendar, the time and the time zone of the value that the calendar has.

| Kind                      | What a press selects                          |
| ------------------------- | --------------------------------------------- |
| `Temporal.PlainDate`      | A day.                                        |
| `Temporal.PlainDateTime`  | A day, and the value keeps its time.          |
| `Temporal.ZonedDateTime`  | A day, and the value keeps its time and zone. |
| `Temporal.PlainYearMonth` | A month, in the grid of months.               |

With no value, the calendar makes a `Temporal.PlainDate`. While the value is `null` or an empty list, `defaultValue` gives the kind of a new value. With no `defaultValue`, the last value of the calendar gives it, with its calendar, its time and its time zone. A month picker thus stays a month picker when its value becomes empty. To make a month picker that starts with no month selected, give `value` the `null` and `defaultValue` a `Temporal.PlainYearMonth`.

The value is `null` when nothing is selected. With `multiple`, the value is a list, and a press on a selected day removes it down to `minDays`. A press past `maxDays` changes nothing. In a single selection, a press on the selected day changes nothing. `readOnly` keeps the days focusable and selects nothing.

## Days

`disabledDates`, `unavailableDates` and `hiddenDates` take a matcher. A matcher is a date, `{ start, end }`, `{ before }`, `{ after }`, `{ dayOfWeek }`, a function, or a list of these. A disabled day cannot take focus and cannot be selected. An unavailable day takes focus and cannot be selected. A hidden day has no button. `minDate` and `maxDate` disable the days outside them and stop the navigation. `modifiers` gives a name to the days that a matcher matches, and each such day has `data-<name>`.

<<< ./calendar/Days.vue

The calendar shows more than one month with `numberOfMonths`, and `pagedNavigation` moves the buttons by that count. `fixedWeeks` gives each month six weeks. `showOutsideDays` gives a button to a day of the month before or after, and a press on it shows its month. `visibleDuration` shows one page of weeks or days, in place of a month. `broadcastCalendar` shows the broadcast months, whose weeks start on Monday. `Calendar.WeekNumber` shows the number of a week: a week that starts on Monday has its ISO 8601 number. `isoWeek` and `firstWeekContainsDate` change that rule. `Calendar.MonthSelect` and `Calendar.YearSelect` choose the month and the year of the page.

A page that the user leaves stays until its animations end. It has `data-ending-style` and `inert`, and the new page has `data-starting-style`. `data-navigation-direction` of the root and of `Calendar.Months` says the side of the move: `previous`, `next` or `none`.

`today` gives the day that is today, and `timeZone` gives the time zone of the clock. `locale` gives the names, the digits, the first day of the week and the weekend, and `firstDayOfWeek` changes the first day. `calendar` shows the dates in another calendar, such as `persian`, and the value keeps its own calendar.

## Months and years

`Calendar.ViewTrigger` shows the grid of years, or with `view="month"` the grid of months. A press while that grid shows goes back to the first view. The text of the trigger is the name of what the grid shows, such as `2026` for the months of a year. The trigger is a live region, so a screen reader reads each change. A press on a year shows the months of that year, and a press on a month shows its days. In the grid of months, the two buttons move one year. In the grid of years, they move a page.

<DemoFrame>
  <DemoCalendarViews />
  <template #tailwind>
    <DemoCalendarViewsTailwind />
  </template>
</DemoFrame>

<DemoSource variant="css-modules">

::: code-group

<<< ../demos/calendar/views/css-modules/index.vue

<<< ../demos/calendar/views/css-modules/index.module.css

:::

</DemoSource>

<DemoSource variant="tailwind">

::: code-group

<<< ../demos/calendar/views/tailwind/index.vue

:::

</DemoSource>

Use `view` and `v-model:view`, or `defaultView`, to choose the view. A calendar with `visibleDuration` shows days only, and its `Calendar.ViewTrigger` is disabled. `columns` gives the cells of a row of `Calendar.MonthGrid` and `Calendar.YearGrid`, and Up and Down move the focus by a row. A page of years has `visibleYears` years, 12 by default, and it starts with a year that is a multiple of that number. The page of 2026 thus has the years from 2016 to 2027.

<<< ./calendar/Months.vue

`disabledMonths` and `disabledYears` take a function. The function of a year gets the first month of that year. A month or a year outside `minDate` and `maxDate` is disabled too. `format` of `Calendar.MonthCell` gives the form of the month name: `long` by default, such as `March`. A month cell has `data-selected` when a selected value is in that month, and `data-current` for the month of today. A year cell has the same states.

## Month picker

A value that is a `Temporal.PlainYearMonth` makes a month picker. Its first view is the grid of months, and it shows no days. A press on a month selects it, and with `multiple` it adds or removes the month. Then `minDays` and `maxDays` count months. A press on a year shows the months of that year.

<DemoFrame>
  <DemoCalendarMonthPicker />
  <template #tailwind>
    <DemoCalendarMonthPickerTailwind />
  </template>
</DemoFrame>

<DemoSource variant="css-modules">

::: code-group

<<< ../demos/calendar/month-picker/css-modules/index.vue

<<< ../demos/calendar/month-picker/css-modules/index.module.css

:::

</DemoSource>

<DemoSource variant="tailwind">

::: code-group

<<< ../demos/calendar/month-picker/tailwind/index.vue

:::

</DemoSource>

The grid shows a year and month in the calendar of the locale only where that calendar has the same months. A Buddhist calendar has them. A value in the ISO calendar thus shows in Buddhist years, and a press gives an ISO value. A Persian month is not an ISO month. A Persian value thus shows in its own months, and a press gives a Persian value.

## Events

The root emits `valueChange` and `update:value` for a selection, and `monthChange` and `update:month` when the page changes. It emits `viewChange` and `update:view` when the view changes, and `focusedDateChange` and `update:focusedDate` when the focus moves to another day. Each event with a name that ends in `Change` has a `details` object with a `reason`. `details.cancel()` stops the change and its `update` event.

| Reason          | When                                                                                                   |
| --------------- | ------------------------------------------------------------------------------------------------------ |
| `day-press`     | A press or Enter or Space on a day.                                                                    |
| `month-press`   | A press on a month cell.                                                                               |
| `year-press`    | A press on a year cell.                                                                                |
| `trigger-press` | A press on `Calendar.ViewTrigger`.                                                                     |
| `month-change`  | A button or a select changes the page.                                                                 |
| `keyboard`      | A key moves the focus, or extends the selection.                                                       |
| `none`          | A focus on a day, a month or a year, or a change that the consumer makes, such as a new `focusedDate`. |

## Server render

The calendar renders with `renderToString`. The server HTML has the grid of the view, its labels, and one tab stop. A server does not know the locale of the visitor. With no `locale` prop, the calendar uses `en-US` until it mounts, and then the locale of the browser.

A server cannot know the day of the visitor. With no `today` prop, the server HTML has the day of the clock of the server. After the mount, the calendar shows the day of the browser: `data-today`, `aria-current`, `data-current`, the tab stop and the years of `Calendar.YearSelect` follow it. When no value, focused day or month gives the page, the calendar shows the page of that day, with no event and no animation. Give `timeZone` when the server knows the time zone of the visitor, or `today` when it knows the day. The server HTML is then correct. The data of `Intl` in a server and in a browser can also give other names of the months and other digits of the years. While the calendar hydrates, each cell and each trigger allows that text, and it then shows the text of the browser.

On a Node.js version before 26, load a `Temporal` polyfill before the server starts. See the [guide](/handbook/dates-and-times#servers).

## Keyboard

Each grid has one tab stop: the focused day, month or year. Else the tab stop is the first selected one, else today, else the first one that can take focus. Left and Right swap in a right-to-left document. A key skips the cells that cannot take focus, and it stops at `minDate` and `maxDate`. A key that leaves the page shows the page of the cell that it reaches.

| Key                          | Days                                       | Months and years                                                             |
| ---------------------------- | ------------------------------------------ | ---------------------------------------------------------------------------- |
| Left, Right                  | The day before or after.                   | The month or year before or after.                                           |
| Up, Down                     | The same day of the week before or after.  | `columns` cells before or after.                                             |
| Home, End                    | The first or the last day of the week.     | The first or the last cell of the row.                                       |
| Page Up, Page Down           | The same day of the month before or after. | The same month a year before or after, or `visibleYears` years in the years. |
| Shift and Page Up, Page Down | The same day a year before or after.       | No action.                                                                   |
| Shift and Left, Right        | The same day a month before or after.      | No action.                                                                   |
| Shift and Up, Down           | The same day a year before or after.       | No action.                                                                   |
| Enter, Space                 | Selects the day.                           | Selects the month, or shows the months of a year, or the days of a month.    |

With `multiple`, Shift and an arrow key moves one day, or one week for Up and Down. The key then adds the day that it reaches to the selection.

## Accessibility

- `Calendar.Root` has `role="group"`. Its name is the visible page: the month, the year, or the years. Give it an `aria-label` or an `aria-labelledby` to replace the name.
- Each grid has `role="grid"`. The grid of days is named by its caption. The grid of months and the grid of years have a name from `Intl.DisplayNames`.
- A day, a month and a year each have a `button`. A month cell has its text and the year as its name, such as `March 2026`. A day button has the full date as its name. A year cell has its year as its name. `aria-current="date"` marks today, and `aria-selected` marks the selection.
- `Calendar.ViewTrigger` and `Calendar.Caption` are live regions, so a screen reader reads a new page. The name of the trigger starts with its text and then says what a press does, such as `November 2026, choose the year`.
- The default labels of the buttons are in English. Give a button an `aria-label` to change it.

## API reference

<ApiReference />

## Additional types

### Calendar.Root.ChangeEventReason

<ApiReference name="Calendar.Root.ChangeEventReason" />

### Calendar.Root.View

<ApiReference name="Calendar.Root.View" />
