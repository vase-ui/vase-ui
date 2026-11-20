---
order: 1
description: An unstyled Vue range calendar component that picks the first day and the last day of a range with a press, a drag or the keyboard.
---

<script setup lang="ts">
import ApiReference from '../.vitepress/components/ApiReference.vue';
import BaseUiDifferences from '../.vitepress/components/BaseUiDifferences.vue';
import DemoFrame from '../.vitepress/components/DemoFrame.vue';
import DemoSource from '../.vitepress/components/DemoSource.vue';
import DemoRangeCalendarHero from '../demos/range-calendar/hero/css-modules/index.vue';
import DemoRangeCalendarHeroTailwind from '../demos/range-calendar/hero/tailwind/index.vue';
import DemoRangeCalendarMinMaxDays from '../demos/range-calendar/min-max-days/css-modules/index.vue';
import DemoRangeCalendarMinMaxDaysTailwind from '../demos/range-calendar/min-max-days/tailwind/index.vue';
import DemoRangeCalendarTwoMonths from '../demos/range-calendar/two-months/css-modules/index.vue';
import DemoRangeCalendarTwoMonthsTailwind from '../demos/range-calendar/two-months/tailwind/index.vue';
</script>

# Range Calendar

A calendar that picks the first day and the last day of a range.

<DemoFrame>
  <DemoRangeCalendarHero />
  <template #tailwind>
    <DemoRangeCalendarHeroTailwind />
  </template>
</DemoFrame>

<DemoSource variant="css-modules">

::: code-group

<<< ../demos/range-calendar/hero/css-modules/index.vue

<<< ../demos/range-calendar/_index.module.css

:::

</DemoSource>

<DemoSource variant="tailwind">

::: code-group

<<< ../demos/range-calendar/hero/tailwind/index.vue

:::

</DemoSource>

## Usage guidelines

- **Load `Temporal` first**: An engine with no `Temporal` needs a polyfill, and TypeScript before 6.0 needs `skipLibCheck`. [Dates and times](/handbook/dates-and-times) gives the steps.
- **Name the range calendar**: With no name of your own, the root has the name of the months that it shows. Give the root an `aria-label`, or an `aria-labelledby` that names a heading, to say what the range is for.

## Anatomy

Import the component and assemble its parts:

<<< ./range-calendar/Anatomy.vue

## Examples

### Pick a range

`RangeCalendar.Root` holds the parts of [Calendar](/components/calendar) and shows days only: `Calendar.ViewTrigger` is disabled in it, and `Calendar.MonthGrid` and `Calendar.YearGrid` render nothing. The value is `[start, end]`, and a range in progress is `[start, null]`.

- The first press on a day starts a range in progress. The root has `data-selecting` until the range ends.
- The second press ends the range, with the two days in the order of the calendar. A press on the first day again gives a range of one day.
- A press after a complete range starts a new range. A press that gives a range that is not valid also starts a new range at the pressed day.
- A range is not valid when it has fewer days than `minDays` or more days than `maxDays`. With no `allowNonContiguousRanges`, a range that crosses a disabled or unavailable day is not valid. With it, the crossed day gets `data-range-middle` and is not selected.
- A drag with a mouse, a pen or a finger from one day to another gives the range in one `valueChange`. When that range is not valid, it ends at the last day that gives a valid range. A press and a release on one day is a press. Escape stops a drag, and the release after it changes nothing.
- While a range is in progress, the day under a mouse or a pen, or the day that has the focus, shows the range that a press on it gives.

`Calendar.Day` and `Calendar.DayButton` have `data-range-start`, `data-range-end` and `data-range-middle`. A range of one day has the first two. The day buttons have `touch-action: none`, so that a finger can drag over the days. To let the page scroll from a day, give the button a `style` with another `touch-action`.

### Minimum and maximum days

`minDays` and `maxDays` give the least and the greatest number of days of a range. Both ends count, so Monday to Wednesday is 3 days. `Calendar.Footer` is a live region for a message below the calendar.

<DemoFrame>
  <DemoRangeCalendarMinMaxDays />
  <template #tailwind>
    <DemoRangeCalendarMinMaxDaysTailwind />
  </template>
</DemoFrame>

<DemoSource variant="css-modules">

::: code-group

<<< ../demos/range-calendar/min-max-days/css-modules/index.vue

<<< ../demos/range-calendar/_index.module.css

:::

</DemoSource>

<DemoSource variant="tailwind">

::: code-group

<<< ../demos/range-calendar/min-max-days/tailwind/index.vue

:::

</DemoSource>

### Two months

`numberOfMonths` shows more than one month. With `pagedNavigation`, the navigation buttons move by that number of months. A range can start in one month and end in another.

<DemoFrame>
  <DemoRangeCalendarTwoMonths />
  <template #tailwind>
    <DemoRangeCalendarTwoMonthsTailwind />
  </template>
</DemoFrame>

<DemoSource variant="css-modules">

::: code-group

<<< ../demos/range-calendar/two-months/css-modules/index.vue

<<< ../demos/range-calendar/_index.module.css

:::

</DemoSource>

<DemoSource variant="tailwind">

::: code-group

<<< ../demos/range-calendar/two-months/tailwind/index.vue

:::

</DemoSource>

### Render on the server

The server HTML has the grid, the range, one tab stop and the touch style of each day. The rules of [Calendar](/components/calendar#render-on-the-server) apply: give `locale`, and give `defaultMonth` or `today` for a month in the server HTML.

## Keyboard

| Key                            | Action                                                                                                                                                                                |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tab                            | Moves the focus to the one tab stop of the grid: the focused day, else the first selected day, else today, else the first day that can take the focus.                                |
| Left Arrow, Right Arrow        | Moves the focus to the day before or after. The two keys swap in a right-to-left document.                                                                                            |
| Up Arrow, Down Arrow           | Moves the focus to the same day of the week before or after.                                                                                                                          |
| Home, End                      | Moves the focus to the first or the last day of the week.                                                                                                                             |
| Page Up, Page Down             | Moves the focus to the same day of the month before or after, or to the last day of a shorter month.                                                                                  |
| Shift+Page Up, Shift+Page Down | Moves the focus to the same day a year before or after.                                                                                                                               |
| Enter, Space                   | Picks the day. The first press starts the range, and the second press ends it.                                                                                                        |
| Shift+Left, Shift+Right        | Moves the focus one day, and makes the range from the first day to that day. The first day is the start of a range in progress, else the day that had the focus before the first key. |
| Shift+Up, Shift+Down           | Moves the focus one week, and makes the range in the same way.                                                                                                                        |
| Escape                         | Stops a drag. Else, puts back the range from before the first press of a range in progress. It works with the focus on each element of the calendar.                                  |

## API reference

<ApiReference />

### RangeCalendar.Root.ChangeEventReason

The `reason` of the details of a change event: `month-change` is a navigation button or a select, and `none` is a focus.

<ApiReference name="RangeCalendar.Root.ChangeEventReason" />

## Differences from Base UI

<BaseUiDifferences />
