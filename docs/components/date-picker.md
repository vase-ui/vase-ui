---
order: 1
description: An unstyled Vue date picker component that shares one Temporal value between a field and a calendar in a popup.
---

<script setup lang="ts">
import ApiReference from '../.vitepress/components/ApiReference.vue';
import BaseUiDifferences from '../.vitepress/components/BaseUiDifferences.vue';
import DemoFrame from '../.vitepress/components/DemoFrame.vue';
import DemoSource from '../.vitepress/components/DemoSource.vue';
import DemoDatePickerDateTime from '../demos/date-picker/date-time/css-modules/index.vue';
import DemoDatePickerDateTimeTailwind from '../demos/date-picker/date-time/tailwind/index.vue';
import DemoDatePickerHero from '../demos/date-picker/hero/css-modules/index.vue';
import DemoDatePickerHeroTailwind from '../demos/date-picker/hero/tailwind/index.vue';
import DemoDatePickerInAForm from '../demos/date-picker/in-a-form/css-modules/index.vue';
import DemoDatePickerInAFormTailwind from '../demos/date-picker/in-a-form/tailwind/index.vue';
import DemoDatePickerMonthPicker from '../demos/date-picker/month-picker/css-modules/index.vue';
import DemoDatePickerMonthPickerTailwind from '../demos/date-picker/month-picker/tailwind/index.vue';
</script>

# Date Picker

A field to type a date in, and a calendar in a popup to pick one.

<DemoFrame>
  <DemoDatePickerHero />
  <template #tailwind>
    <DemoDatePickerHeroTailwind />
  </template>
</DemoFrame>

<DemoSource variant="css-modules">

::: code-group

<<< ../demos/date-picker/hero/css-modules/index.vue

<<< ../demos/date-picker/_index.module.css

:::

</DemoSource>

<DemoSource variant="tailwind">

::: code-group

<<< ../demos/date-picker/hero/tailwind/index.vue

:::

</DemoSource>

## Usage guidelines

- **The picker needs `Temporal`**: Load a `Temporal` polyfill for an engine that has none, such as Safari and Node.js 24. Use TypeScript 6.0, or set `skipLibCheck`. See [Dates and times](/handbook/dates-and-times).
- **Form controls must have an accessible name**: Put the picker in a `Field` with a `Field.Label`, give `DatePicker.Field` an `aria-label` or an `aria-labelledby`, or point a `<label for>` at the `id` of `DatePicker.Field`. A `<label for>` names the field only after the mount, so the server HTML has no name for it. See the [forms guide](/handbook/forms).
- **The trigger must have a name**: Give `DatePicker.Trigger` content or an `aria-label` in the language of the page. See [Show the value in the trigger](#show-the-value-in-the-trigger).
- **The popup must have a name**: Give `DatePicker.Popup` an `aria-label`, or put a `Popover.Title` in it.
- **The time field must have a name**: Give `DatePicker.TimeField` an `aria-label`. A `Field` around the picker does not name it.

## Anatomy

Import the component and assemble its parts:

<<< ./date-picker/Anatomy.vue

## Examples

### Date and time

To pick a date and a time, put a date picker and a [Time Picker](/components/time-picker) side by side. Keep the date and the time each in a ref of its own, and join them with `toPlainDateTime`. A picker gives `null` while its field has an empty segment. With a ref for each part, an empty segment in one field does not change the other field.

One picker can also hold a date and a time. With a `granularity` that has a time, or a value with a time, the field shows the time segments, and a press on a day keeps the time. `DatePicker.TimeField` is then a field for that time in the popup. The popup stays open after a pick, so give it a `Popover.Close`.

<DemoFrame>
  <DemoDatePickerDateTime />
  <template #tailwind>
    <DemoDatePickerDateTimeTailwind />
  </template>
</DemoFrame>

<DemoSource variant="css-modules">

::: code-group

<<< ../demos/date-picker/date-time/css-modules/index.vue

<<< ../demos/date-picker/_index.module.css

:::

</DemoSource>

<DemoSource variant="tailwind">

::: code-group

<<< ../demos/date-picker/date-time/tailwind/index.vue

:::

</DemoSource>

### Month picker

A `Temporal.PlainYearMonth` value, or `granularity="month"`, makes a picker for a month. The calendar then shows the months of a year, and a press on a month selects it.

<DemoFrame>
  <DemoDatePickerMonthPicker />
  <template #tailwind>
    <DemoDatePickerMonthPickerTailwind />
  </template>
</DemoFrame>

<DemoSource variant="css-modules">

::: code-group

<<< ../demos/date-picker/month-picker/css-modules/index.vue

<<< ../demos/date-picker/_index.module.css

:::

</DemoSource>

<DemoSource variant="tailwind">

::: code-group

<<< ../demos/date-picker/month-picker/tailwind/index.vue

:::

</DemoSource>

### In a form

Put the picker in a `Field` to show the errors of its validation. The form input of `DatePicker.Field` has the type of the value, so `min` and `max` give `rangeUnderflow` and `rangeOverflow`, and `required` gives `valueMissing`. The picker sets a `customError` for a date that `unavailableDates` matches, as [Date Field](/components/date-field) does.

<DemoFrame>
  <DemoDatePickerInAForm />
  <template #tailwind>
    <DemoDatePickerInAFormTailwind />
  </template>
</DemoFrame>

<DemoSource variant="css-modules">

::: code-group

<<< ../demos/date-picker/in-a-form/css-modules/index.vue

<<< ../demos/date-picker/_index.module.css

:::

</DemoSource>

<DemoSource variant="tailwind">

::: code-group

<<< ../demos/date-picker/in-a-form/tailwind/index.vue

:::

</DemoSource>

### Show the value in the trigger

The `text` of the slots of `DatePicker.Trigger` is the value in the locale, or `undefined` with no value. Show it in the trigger, so that the text is the name of the trigger. A server can have other `Intl` data than the browser, so give the element of the text `data-allow-mismatch="text"`:

<<< ./date-picker/TriggerText.vue{11-13}

## Keyboard

| Key                                                                                                     | Action                                                                                                                    |
| ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Alt+Down in the field                                                                                   | Opens the popup. The focus goes to the day or the month that has the tab stop.                                            |
| Enter, Space                                                                                            | On the trigger, opens the popup. On a day or a month, selects it and closes the popup, unless `closeOnSelect` is `false`. |
| Escape                                                                                                  | Closes the popup and gives the focus back to the trigger. The value stays.                                                |
| Tab                                                                                                     | Moves the focus through the popup in the order of the page, after the trigger.                                            |
| The keys of [Date Field](/components/date-field#keyboard) and [Calendar](/components/calendar#keyboard) | Do the same actions in the field and in the calendar.                                                                     |

## API reference

<ApiReference />

### DatePicker.Root.ChangeEventReason

The reason of `valueChange`: `day-press` and `month-press` for a pick in the calendar, and the other reasons for a change in the field, as in [Date Field](/components/date-field).

<ApiReference name="DatePicker.Root.ChangeEventReason" />

### DatePicker.Root.OpenChangeEventReason

The reason of `openChange`: Alt+Down in the field gives `trigger-press`, and a pick that closes the popup gives `imperative-action`.

<ApiReference name="DatePicker.Root.OpenChangeEventReason" />

## Differences from Base UI

<BaseUiDifferences />
