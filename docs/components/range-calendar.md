---
order: 1
description: An unstyled Vue calendar that picks the first day and the last day of a range with a press, a drag or the keyboard.
---

<script setup lang="ts">
import ApiReference from '../.vitepress/components/ApiReference.vue';
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

Base UI has no range calendar. This one follows the [grid pattern](https://www.w3.org/WAI/ARIA/apg/patterns/grid/) of the WAI-ARIA Authoring Practices Guide. Its types need TypeScript 6.0, or `skipLibCheck`. The [dates and times guide](/handbook/dates-and-times) has the details, and the polyfill for an engine with no `Temporal`.

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

- **A range calendar must have an accessible name**: With no name of your own, the root has the name of the month that it shows. Give the root an `aria-label`, or an `aria-labelledby` that names a heading, to say what the range is for.

## Anatomy

Import the component and assemble its parts:

<<< ./range-calendar/Anatomy.vue

`RangeCalendar.Root` is the one part of this component. It holds the parts of [Calendar](/components/calendar), and `Calendar.Day` and `Calendar.DayButton` read the range from it. A range root has no views, so `Calendar.ViewTrigger` is disabled in it, and `Calendar.MonthGrid` and `Calendar.YearGrid` render nothing.

## Value

The value is a list of two ends, `[start, end]`, and `v-model` gives back the same kind. Each end is a `Temporal.PlainDate`, a `Temporal.PlainDateTime` or a `Temporal.ZonedDateTime`. A range with no days is `[null, null]`.

A new end has the kind, the time, the time zone and the calendar of the end that it replaces. After you clear the range, the calendar uses the first nonempty end of `defaultValue` or the last known end. Without either, it creates a `Temporal.PlainDate` in the ISO calendar.

The root emits `valueChange` with the new value and `eventDetails`, and then `update:modelValue`. To stop the change, call `eventDetails.cancel()` before the `valueChange` listener returns. The root then emits no `update:modelValue` and keeps its value. The reason is `day-press` for a press, `drag` for a drag and `keyboard` for a key.

## Pick a range

- The first press on a day gives `[day, null]`. This is a range in progress. The root has the attribute `data-selecting` until the range ends.
- The second press gives the two days in the order of the calendar. A press on the first day again gives a range of one day.
- A press on a day after a complete range starts a new range.
- A press that would give a range that is not valid starts a new range at the pressed day. A range is not valid when it has fewer days than `minDays` or more days than `maxDays`. It is also not valid when it crosses a day that is disabled or unavailable. Set `allowNonContiguousRanges` to allow that. The crossed day has `data-range-middle` and is not selected.
- A drag with the mouse, a pen or a finger from one day to another gives the range in one `valueChange`. The range ends at the day under the pointer, or keeps its last day while the pointer is over no day. When that range is not valid, it ends at the last day between the first day and the pointer that gives a valid range, such as the day before a disabled day. A drag that reaches no valid range changes nothing. A press and a release on one day is a press, not a drag. Escape ends a drag, and the release after it changes nothing. The day buttons have `touch-action: none`, so that a finger can drag over the days. To let the page scroll from a day, give the button a `style` with another `touch-action`.
- `readonly` and `disabled` stop each press, each drag and the preview.

A day has `data-range-start` when it is the first day of the range, `data-range-end` when it is the last day and `data-range-middle` when it is between them. A range of one day has the first two attributes and no third. A day in the range that the user can select has `aria-selected="true"`, and its button has `data-selected`.

While a range is in progress, the three attributes show the range that a press on the day under the pointer, or on the day that has the focus, would give. The day under the pointer is the day of the last `pointerenter` of a mouse or a pen. A pointer of a finger has no hover. A press that would start a new range shows that day alone.

## Examples

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

`numberOfMonths` shows more than one month. With `pagedNavigation`, the two buttons move by that number of months. A range can start in one month and end in another.

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

## Server render

The calendar renders with `renderToString`. The server HTML has the grid, the range, one tab stop and the touch style of each day. The preview and the drag are for the browser.

No render reads the clock or the locale of the visitor, as in [Calendar](/components/calendar#server-render). With no `today`, the server HTML marks no day as today, and the root reads the clock after the mount. Give `locale`, `calendar`, `firstDayOfWeek` and `today` when the server knows them.

On a Node.js version before 26, load a `Temporal` polyfill before the server starts. See the [guide](/handbook/dates-and-times#servers).

## Keyboard

The focus is in the grid of days, and one day has the tab stop. Left and Right swap in a right-to-left document. A move skips each day that is disabled or hidden, and stops at `min` and `max`. A move out of the page shows the page of the new day. Escape works with the focus on each element of the calendar, such as a button that changes the month.

| Key                            | Result                                                                                                                                                                           |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Left, Right                    | The day before or after.                                                                                                                                                         |
| Up, Down                       | The same day of the week before or after.                                                                                                                                        |
| Home, End                      | The first or the last day of the week.                                                                                                                                           |
| Page Up, Page Down             | The same day of the month before or after. The last day, when that month is shorter.                                                                                             |
| Shift+Page Up, Shift+Page Down | The same day a year before or after.                                                                                                                                             |
| Enter, Space                   | Picks the day. The first press starts the range, and the second press ends it.                                                                                                   |
| Shift+Left, Shift+Right        | Moves a day, and makes the range from the first day to that day. The first day is the first day of a range in progress, or else the day that had the focus before the first key. |
| Shift+Up, Shift+Down           | Moves a week, and makes the range in the same way.                                                                                                                               |
| Escape                         | Ends a drag. Else, puts back the range from before the first press of a range in progress. The calendar prevents the key only in these two cases.                                |

## Accessibility

- `RangeCalendar.Root` has `role="group"`. Its name is the month that it shows, until you give it an `aria-label` or an `aria-labelledby`.
- `Calendar.Grid` is a `grid` that has `aria-multiselectable="true"`. Its name is the caption of its month, or the name of the month when the month has no caption.
- Each day button has the full date as its name, and `aria-current="date"` for today. Its cell has `aria-selected`.
- A day that is disabled has `aria-disabled` and no tab stop. A day that is unavailable has `aria-disabled` and takes the focus.

## API reference

<ApiReference />
