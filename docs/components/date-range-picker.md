---
order: 1
description: An unstyled Vue date range picker component that shares one range of Temporal values between two fields and a calendar in a popup.
---

<script setup lang="ts">
import ApiReference from '../.vitepress/components/ApiReference.vue';
import BaseUiDifferences from '../.vitepress/components/BaseUiDifferences.vue';
import DemoFrame from '../.vitepress/components/DemoFrame.vue';
import DemoSource from '../.vitepress/components/DemoSource.vue';
import DemoDateRangePickerHero from '../demos/date-range-picker/hero/css-modules/index.vue';
import DemoDateRangePickerHeroTailwind from '../demos/date-range-picker/hero/tailwind/index.vue';
</script>

# Date Range Picker

Two fields to type the first day and the last day of a range in, and a calendar in a popup to pick them.

<DemoFrame>
  <DemoDateRangePickerHero />
  <template #tailwind>
    <DemoDateRangePickerHeroTailwind />
  </template>
</DemoFrame>

<DemoSource variant="css-modules">

::: code-group

<<< ../demos/date-range-picker/hero/css-modules/index.vue

<<< ../demos/date-range-picker/_index.module.css

:::

</DemoSource>

<DemoSource variant="tailwind">

::: code-group

<<< ../demos/date-range-picker/hero/tailwind/index.vue

:::

</DemoSource>

## Usage guidelines

- **The picker needs `Temporal`**: Load a `Temporal` polyfill for an engine that has none, such as Safari and Node.js 24. Use TypeScript 6.0, or set `skipLibCheck`. See [Dates and times](/handbook/dates-and-times).
- **Each field must have an accessible name**: Give each field an `aria-label` in the language of the page, such as `Start date`. In a `Field`, the label of the `Field` joins that name, as in `Start date Trip dates`. A field with no `aria-label` in a `Field` has the name of the label alone. The `aria-labelledby` of a field replaces both. See the [forms guide](/handbook/forms).
- **The trigger must have a name**: Give `DateRangePicker.Trigger` content or an `aria-label` in the language of the page. See [Show the range in the trigger](#show-the-range-in-the-trigger).
- **The popup must have a name**: Give `DateRangePicker.Popup` an `aria-label`, or put a `Popover.Title` in it.

## Anatomy

Import the component and assemble its parts:

<<< ./date-range-picker/Anatomy.vue

Give the `z-index` of the popup to `DateRangePicker.Positioner`: see [Portals](/quick-start#portals).

## Examples

### In a form

Each field gives its end to a form through its form input. Name them with `startName` and `endName`. The form inputs have the type of the ends, so `min` and `max` give `rangeUnderflow` and `rangeOverflow`, and `required` gives `valueMissing` for each empty end. As in [Date Field](/components/date-field), each field reports some empty segments as `badInput`, a limit that the input type cannot check as `rangeUnderflow` or `rangeOverflow`, and a date that `unavailableDates` matches as `customError`.

The end field is invalid when it is before the first end of the range, or before `min`. Its form input then gives `rangeUnderflow`, also for a zoned value. A field that shows a time compares the time too, so a time before the first time of the same day is invalid. A field that shows no time compares days. Two zoned ends compare by the moment, also when they are in two time zones.

Put the picker in a `Field` to show the errors of its validation. The picker is the one control of the `Field`, and a change of either end validates it. Each form input keeps the name of `startName` or `endName`, and the name of the `Field` is the key of its errors. The `Field` counts a leave only when the focus leaves both fields.

### Show the range in the trigger

The `text` of the slots of `DateRangePicker.Trigger` is the range in the locale, or `undefined` while an end has no value. Show it in the trigger as in the [sample of Date Picker](/components/date-picker#show-the-value-in-the-trigger). Give the element of the text `data-allow-mismatch="text"`, because a server can have other `Intl` data than the browser.

## Keyboard

| Key                                                                                                                 | Action                                                                                                                                                                    |
| ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Alt+Down in a field                                                                                                 | Opens the popup. The focus goes to the day that has the tab stop.                                                                                                         |
| Enter, Space                                                                                                        | On the trigger, opens the popup. On a day, picks it. The second pick closes the popup, unless `closeOnSelect` is `false`.                                                 |
| Escape                                                                                                              | Closes the popup and gives the focus back to the trigger. With the focus in the calendar, it also puts back the range from before the first press of a range in progress. |
| Tab                                                                                                                 | Moves the focus through the popup in the order of the page, after the trigger.                                                                                            |
| The keys of [Date Field](/components/date-field#keyboard) and [Range Calendar](/components/range-calendar#keyboard) | Do the same actions in the fields and in the calendar.                                                                                                                    |

## API reference

<ApiReference />

### DateRangePicker.Root.ChangeEventReason

The reason of `valueChange`: `day-press` and `drag` come from the calendar, `keyboard` from the calendar or a field, and the other reasons from a field.

<ApiReference name="DateRangePicker.Root.ChangeEventReason" />

### DateRangePicker.Root.OpenChangeEventReason

The reason of `openChange`: Alt+Down in a field gives `trigger-press`, and a pick or a drag that closes the popup gives `imperative-action`.

<ApiReference name="DateRangePicker.Root.OpenChangeEventReason" />

## Differences from Base UI

<BaseUiDifferences />
