---
order: 1
description: An unstyled Vue calendar for days, months and years, on the Temporal API.
---

<script setup lang="ts">
import ApiReference from '../.vitepress/components/ApiReference.vue';
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

<<< ../demos/calendar/_index.module.css

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

Each part renders one element. `as` gives another tag or a component. The slot `element` replaces the element: it gets `props`, `elementRef` and `state`, and the slot of a list part also gets its items. A template ref on a part has `element`, and the ref of the root also has `focus()`.

## Value

The value is a `Temporal` object, and `v-model` gives back the same kind. A new value has the kind, the calendar, the time and the time zone of the value that the calendar has.

| Kind                      | What a press selects                          |
| ------------------------- | --------------------------------------------- |
| `Temporal.PlainDate`      | A day.                                        |
| `Temporal.PlainDateTime`  | A day, and the value keeps its time.          |
| `Temporal.ZonedDateTime`  | A day, and the value keeps its time and zone. |
| `Temporal.PlainYearMonth` | A month, in the grid of months.               |

With no value, the calendar makes a `Temporal.PlainDate`. While the value is `null` or an empty list, `defaultValue` gives the kind of a new value. With no `defaultValue`, the last value of the calendar gives it, with its calendar, its time and its time zone. A month picker thus stays a month picker when its value becomes empty. To make a month picker that starts with no month selected, set `modelValue` to `null` and `defaultValue` to a `Temporal.PlainYearMonth`.

The value is `null` when nothing is selected. With `multiple`, the value is a list, and a press on a selected day removes it down to `minDays`. A press past `maxDays` changes nothing. In a single selection, a press on the selected day changes nothing. `readonly` keeps the days focusable and selects nothing.

## Days

`disabledDates`, `unavailableDates` and `hiddenDates` take a matcher. A matcher is a date, `{ start, end }`, `{ before }`, `{ after }`, `{ dayOfWeek }`, a function, or a list of these. A disabled day cannot take focus and cannot be selected. An unavailable day takes focus and cannot be selected. A hidden day has no button. `min` and `max` disable the days outside them and stop the navigation. `modifiers` gives a name to the days that a matcher matches, and each such day has `data-<name>`.

<<< ./calendar/Days.vue

`fixedWeeks` gives each month six weeks. `showOutsideDays` gives a button to a day of the month before or after, and a press on it shows its month.

`today` gives the day that is today. `locale` gives the names and the digits, and `LocaleProvider` gives it to each calendar in it. With neither, the text is `en-US`. The weeks start on Monday, and `firstDayOfWeek` changes the first day: `7` is Sunday. A weekend is a modifier, such as `:modifiers="{ weekend: { dayOfWeek: [6, 7] } }"`.

An app with no server render can take the first day of the week of a locale from the browser: `new Intl.Locale(locale).getWeekInfo?.().firstDay ?? 1`. A browser that lacks the method gives `1`, so give `firstDayOfWeek` from your own data in a server render.

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

<<< ../demos/calendar/_index.module.css

:::

</DemoSource>

<DemoSource variant="tailwind">

::: code-group

<<< ../demos/calendar/views/tailwind/index.vue

:::

</DemoSource>

Use `view` and `v-model:view`, or `defaultView`, to choose the view. A calendar with `visibleDuration` shows days only, and its `Calendar.ViewTrigger` is disabled. `columns` gives the cells of a row of `Calendar.MonthGrid` and `Calendar.YearGrid`, and Up and Down move the focus by a row. A page of years has `visibleYears` years, 12 by default, and it starts with a year that is a multiple of that number. The page of 2026 thus has the years from 2016 to 2027.

<<< ./calendar/Months.vue

`disabledMonths` and `disabledYears` take a function. The function of a year gets the first month of that year. A month or a year outside `min` and `max` is disabled too. `format` of `Calendar.MonthCell` gives the form of the month name: `long` by default, such as `March`. A month cell has `aria-selected="true"` when a selected value is in that month, and `aria-current="date"` for the month of today. A year cell has the same states.

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

<<< ../demos/calendar/_index.module.css

:::

</DemoSource>

<DemoSource variant="tailwind">

::: code-group

<<< ../demos/calendar/month-picker/tailwind/index.vue

:::

</DemoSource>

The grid shows a year and month in the calendar of the locale only where that calendar has the same months. A Buddhist calendar has them. A value in the ISO calendar thus shows in Buddhist years, and a press gives an ISO value. A Persian month is not an ISO month. A Persian value thus shows in its own months, and a press gives a Persian value.

## Examples

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

This calendar is for a delivery on a working day in the 8 weeks from today. `disabledDates` matches Saturday and Sunday, so the keys skip them.

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

This calendar marks the public holidays with the modifier `holiday`. The style sheet draws a dot on a day that has `data-holiday`. A screen reader does not read the dot, so the button of such a day has the name of the holiday as its `aria-description`. The footer also says the name of the holiday of the selected day.

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

`numberOfMonths` shows that number of months, one after the other, and `state.multipleMonths` of the root is `true`. With `pagedNavigation`, the two buttons move by that number of months. Without it, they move by one month.

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

`Calendar.WeekNumber` shows the number of a week, and `Calendar.WeekNumberHeader` is the header of that column. By default, the weeks start on Monday and have their ISO 8601 number. `firstWeekContainsDate` gives the day of January that is always in the first week.

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

`visibleDuration` shows one page of weeks or days, in place of a month, and the two buttons move by that page. This calendar shows one week. `format` of `Calendar.Caption` gives the form of the first day and the last day of the page.

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

`calendar` shows the dates in another calendar, such as `persian`, and the value keeps its own calendar. This calendar shows Persian months, and its value is an ISO date. With no `calendar`, the grid takes the calendar of a value that is not ISO, and else the calendar of the locale. `calendar="gregory"` turns the calendar of the locale off.

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

### Animation

Animate a page with the `<Transition>` of Vue around `Calendar.Grid`, with the first day of the month as its key. The grid that leaves is `inert`. `data-navigation-direction` of the root and of `Calendar.Months` says the side of the move: `previous`, `next` or `none`. This calendar fades each grid and moves it 0.5rem, to the left for `next` and to the right for `previous`. The caption stays, and its live region reads the new month. `fixedWeeks` and `showOutsideDays` give each page six rows of buttons, so the grid keeps its height. The style sheet has no transition for a person who prefers reduced motion.

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

## Events

The root emits `valueChange` and `update:modelValue` for a selection, and `monthChange` and `update:month` when the page changes. It emits `viewChange` and `update:view` when the view changes, and `focusedDateChange` and `update:focusedDate` when the focus moves to another day. Each event with a name that ends in `Change` has a `details` object with a `reason`. `details.cancel()` stops the change and its `update` event. A move that no user makes, such as a new `focusedDate` of the parent or `focus(date)`, emits only the `update` event.

| Reason          | When                                             |
| --------------- | ------------------------------------------------ |
| `day-press`     | A press or Enter or Space on a day.              |
| `month-press`   | A press on a month cell.                         |
| `year-press`    | A press on a year cell.                          |
| `trigger-press` | A press on `Calendar.ViewTrigger`.               |
| `month-change`  | A button or a select changes the page.           |
| `keyboard`      | A key moves the focus, or extends the selection. |
| `none`          | A focus on a day, a month or a year.             |

## Server render

The calendar renders with `renderToString`, and the server HTML has the grid of the view, its labels, and one tab stop. No render reads the clock or the locale of the visitor, so the server and the browser render the same grid. Give `locale`, or the text is `en-US`.

With no `today`, the root reads the clock after the mount. The server HTML then marks no day as today, and with no value, `month`, `defaultMonth` or focused day it has no month: the page of today comes after the mount, with no event. Give `defaultMonth`, or keep the room of the month in CSS. A server that knows the day of the visitor gives `today` with the data of the page. An expression of `Temporal.Now` in a template can give another day in the browser.

The grid takes no calendar from the locale, because a server and a browser can give a locale another calendar. Give `calendar` for a calendar that is not Gregorian. A server and a browser can also write other names of the days and another form of a full date or a range. `Calendar.Weekday`, `Calendar.Caption` and `Calendar.ViewTrigger` allow another text in the hydration, and Vue then writes the text of the browser. A name in an `aria-*` attribute keeps the text of the server until the part renders again. Give `data-allow-mismatch` to another part that shows such a text.

On a Node.js version before 26, load a `Temporal` polyfill before the server starts. See the [guide](/handbook/dates-and-times#servers).

## Keyboard

Call `focus()` on the root to focus the current tab stop. `focus(date)` shows the page of that day first.

Each grid has one tab stop: the focused day, month or year. Else the tab stop is the first selected one, else today, else the first one that can take focus. Left and Right swap in a right-to-left document. A key skips the cells that cannot take focus, and it stops at `min` and `max`. Call `event.stopPropagation()` in a key listener of a button to keep the key from the calendar. A key that leaves the page shows the page of the cell that it reaches.

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
- `Calendar.ViewTrigger` and `Calendar.Caption` are live regions, so a screen reader reads a new page. The trigger is named by its text. Give it an `aria-description` that says what a press does.
- The two navigation buttons are named by `Intl.RelativeTimeFormat` in the locale, such as `next month`, and `Calendar.WeekNumberHeader` and the two selects by `Intl.DisplayNames`. An `aria-label` of the developer replaces such a name.

## API reference

<ApiReference />

## Additional types

### Calendar.Root.ChangeEventReason

<ApiReference name="Calendar.Root.ChangeEventReason" />

### Calendar.Root.View

<ApiReference name="Calendar.Root.View" />
