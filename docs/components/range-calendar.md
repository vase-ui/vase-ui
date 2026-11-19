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

`RangeCalendar.Root`, `RangeCalendar.Day` and `RangeCalendar.DayButton` are the parts of this component. Each other part is the part of Calendar with the same name, and it reads the range from the root.

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
- `readOnly` and `disabled` stop each press, each drag and the preview.

A day has `data-range-start` when it is the first day of the range, `data-range-end` when it is the last day and `data-range-middle` when it is between them. A range of one day has the first two attributes and no third. A day in the range that the user can select has `data-selected` and `aria-selected="true"`.

While a range is in progress, the three attributes show the range that a press on the day under the pointer, or on the day that has the focus, would give. The day under the pointer is the day of the last `pointerenter` of a mouse or a pen. A pointer of a finger has no hover. A press that would start a new range shows that day alone.

## Examples

### Minimum and maximum days

`minDays` and `maxDays` give the least and the greatest number of days of a range. Both ends count, so Monday to Wednesday is 3 days. `RangeCalendar.Footer` is a live region for a message below the calendar.

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

A server cannot know the day of the visitor. With no `today` prop, the server HTML has the day of the clock of the server. After the mount, the calendar shows the day of the browser: `data-today`, `aria-current` and the tab stop follow it. When no value, focused day or month gives the page, the calendar shows the page of that day, with no event and no animation. Give `timeZone` when the server knows the time zone of the visitor, or `today` when it knows the day. The server HTML is then correct. With no `locale` prop, the calendar uses `en-US` until it mounts, and then the locale of the browser.

A server and a browser can also have another calendar, first day of the week or weekend for one locale. The range calendar then hydrates with the grid of the server, and it shows the grid of the browser after the mount. Give `calendar` and `firstDayOfWeek`, and the server HTML has the days and the weeks of the final grid. The weekend has no prop, so `data-weekend` follows the browser. A browser whose `Temporal` does not have the calendar of the server cannot show the grid of the server, and Vue then reports a hydration mismatch. The entry `temporal-polyfill/global` has only the ISO and Gregorian calendars, so it is such a `Temporal`.

On a Node.js version before 26, load a `Temporal` polyfill before the server starts. See the [guide](/handbook/dates-and-times#servers).

## Keyboard

The focus is in the grid of days, and one day has the tab stop. Left and Right swap in a right-to-left document. A move skips each day that is disabled or hidden, and stops at `minDate` and `maxDate`. A move out of the page shows the page of the new day. Escape works with the focus on each element of the calendar, such as a button that changes the month.

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
- `RangeCalendar.Grid` is a `grid` that has `aria-multiselectable="true"`. Its name is the caption of its month, or the name of the month when the month has no caption.
- Each day button has the full date as its name, and `aria-current="date"` for today. Its cell has `aria-selected`.
- A day that is disabled has `aria-disabled` and no tab stop. A day that is unavailable has `aria-disabled` and takes the focus.

## API reference

<ApiReference />
