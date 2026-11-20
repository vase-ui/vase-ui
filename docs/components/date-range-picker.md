---
order: 1
description: An unstyled Vue date range picker with two fields and a calendar in a popup that share one range of Temporal values.
---

<script setup lang="ts">
import ApiReference from '../.vitepress/components/ApiReference.vue';
import DemoFrame from '../.vitepress/components/DemoFrame.vue';
import DemoSource from '../.vitepress/components/DemoSource.vue';
import DemoDateRangePickerHero from '../demos/date-range-picker/hero/css-modules/index.vue';
import DemoDateRangePickerHeroTailwind from '../demos/date-range-picker/hero/tailwind/index.vue';
</script>

# Date Range Picker

A date range picker has two fields, where the user types the first day and the last day of a range. It also has a popup with a calendar, where the user picks them. The fields and the calendar share one range.

Base UI has no date range picker. This one follows the [Date Picker Dialog pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/examples/datepicker-dialog/) of the WAI-ARIA Authoring Practices Guide, with the [Range Calendar](/components/range-calendar) in the popup. Its types need TypeScript 6.0, or `skipLibCheck`. The [dates and times guide](/handbook/dates-and-times) has the details, and the polyfill for an engine with no `Temporal`.

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

- **Each field must have an accessible name**: Give each field an `aria-label` in the language of the page, such as `Start date`. In a `Field`, the label of the `Field` joins that name, as in `Start date Trip dates`. A field with no `aria-label` in a `Field` has the name of the label alone. The `aria-labelledby` of a field replaces both. See the [forms guide](/handbook/forms).
- **The trigger must have a name**: Give `DateRangePicker.Trigger` content or an `aria-label`. The `text` of its slots is the range in the locale.
- **The popup must have a name**: Give `DateRangePicker.Popup` an `aria-label`, or put a `Popover.Title` in it.

## Anatomy

Import the component and assemble its parts:

<<< ./date-range-picker/Anatomy.vue

`DateRangePicker.Root` renders `Popover.Root` and no element of its own. It holds the range and shares it with its parts. `DateRangePicker.StartField` and `DateRangePicker.EndField` render `DateField.Root`, and `DateRangePicker.Calendar` renders `RangeCalendar.Root`. Write the parts of those components inside them, as the pages of [Date Field](/components/date-field) and [Range Calendar](/components/range-calendar) show.

`DateRangePicker.Trigger`, `DateRangePicker.Positioner` and `DateRangePicker.Popup` render `Popover.Trigger`, `Popover.Positioner` and `Popover.Popup`. The other parts of the popup are the parts of [Popover](/components/popover) by their own names: `Popover.Portal`, `Popover.Arrow`, `Popover.Backdrop`, `Popover.Close`, `Popover.Title` and `Popover.Description`. The positioner puts the popup against the box around the two fields, and against the trigger when the picker has no field.

A part that renders a part of another family takes each prop, attribute and event of that part that the picker does not own. The props that the picker owns, such as the range and the limits, are on `DateRangePicker.Root`.

## Value

The value is a range of two `Temporal` objects, the first day and the last day. `v-model` gives back the same kind: a `Temporal.PlainDate`, a `Temporal.PlainDateTime` or a `Temporal.ZonedDateTime`. An end is `null` while it has no value, and `null` is the same as `[null, null]`. A range in progress has its first day and a `null` last day.

The root owns the props that its parts share: `granularity`, `referenceDate`, `hourCycle`, `forceLeadingZeros`, `hideTimeZone`, `min`, `max`, `unavailableDates`, `locale`, `calendar`, `timeZone`, `disabled`, `readonly`, `required` and `form`. The default `locale` is the locale of the nearest `LocaleProvider`, else `en-US`. Give the props of the range calendar that the root does not own, such as `numberOfMonths`, `minDays`, `maxDays` and `allowNonContiguousRanges`, to `DateRangePicker.Calendar`.

With no value, a new end has the kind that `granularity` and `referenceDate` give, as for [Date Field](/components/date-field#value). With a `granularity` that has a time, or a range with a time, the fields show the time segments. A press on a day keeps the time of the end that it replaces. A picker that the user empties keeps the kind of its last range.

`closeOnSelect` says if the second press in the calendar closes the popup. It is `true`, also for a range with a time, because the popup has no part for a time: the user sets a time in a field. The first press only starts the range. A drag closes the popup too, because it makes the whole range. This is also true for a drag that makes the range that the picker already has, although the calendar gives no change for it. A key that extends the range does not, because the user can extend it more. Escape and a press outside the popup close it.

In a [wrapper of `DateRangePicker.Root`](/handbook/composition#wrap-a-part), give `closeOnSelect` the default `undefined` to keep this behavior.

## In a form

Each field gives its end to a form through its hidden input. Name them with `startName` and `endName`. The hidden inputs have the type of the ends, so `min` and `max` give `rangeUnderflow` and `rangeOverflow`, and `required` gives `valueMissing` for each empty end. As in [Date Field](/components/date-field), each field reports a field with some segments empty as `badInput`, a limit that the input type cannot check as `rangeUnderflow` or `rangeOverflow`, and a date that `unavailableDates` matches as `customError`.

The end field is invalid when it is before the first end of the range, or before `min`. Its `min` is the later of the two, so its hidden input gives `rangeUnderflow`, also for a zoned value. A change of the first end to a later moment than the last end also makes the end field invalid. A field that shows a time compares the time too, so a time that is before the first time of the same day is invalid. A field that shows no time compares days. Two zoned ends compare by the moment, also when they are in two time zones.

Put the picker in a `Field` to show the errors of its validation. The picker is the one control of the `Field`, and the `Field` gets the range: a change of either end validates. Each form input keeps the name of `startName` or `endName`, and the name of the `Field` is the key of its errors. The `Field` counts a leave only when the focus leaves both fields. A reset of the form gives the picker its first range, also a controlled picker, with `update:modelValue` only.

## Events

The root emits `valueChange` and `update:modelValue` for each change of the range. It emits `openChange` and `update:open` when the popup opens or closes. To run code after the animations of the popup, use the hooks of a `<Transition>` around `DateRangePicker.Popup`. A `details.cancel()` in `valueChange` or `openChange` stops the change and its `update` event.

| Reason of `valueChange` | When                                                     |
| ----------------------- | -------------------------------------------------------- |
| `day-press`             | A press or Enter or Space on a day.                      |
| `drag`                  | A drag over the days.                                    |
| `keyboard`              | A key in the calendar, Escape included, or in a segment. |
| `input-change`          | Typing or autofill in a segment.                         |
| `input-clear`           | The user removes a digit with the text input.            |
| `input-paste`           | A paste in a segment.                                    |
| `clear-press`           | A press on a clear button.                               |

| Reason of `openChange` | When                                                                 |
| ---------------------- | -------------------------------------------------------------------- |
| `trigger-press`        | A press on the trigger, and Alt+Down in a field.                     |
| `imperative-action`    | The second press or a drag closes the popup, or a call of `close()`. |
| `escape-key`           | Escape closes the popup.                                             |
| `outside-press`        | A press outside the popup closes it.                                 |
| `close-press`          | A press on `Popover.Close`.                                          |
| `focus-out`            | The focus leaves a popup that is not modal.                          |

## Server render

The picker renders with `renderToString`. The server HTML has the two fields with their segments and their hidden inputs, and the trigger. It has no popup, also for a picker that is open at the mount, because the portal renders after the mount. No render reads the clock: the picker reads today at its mount and at each open.

The server and the browser use the same `locale`. An element that shows the `text` of the trigger needs `data-allow-mismatch="text"`, because a server can have other `Intl` data. See [Date Field](/components/date-field#server-render) and [Range Calendar](/components/range-calendar#server-render) for what a server and a browser can show in another way.

On a Node.js version before 26, load a `Temporal` polyfill before the server starts. See the [guide](/handbook/dates-and-times#servers).

## Keyboard

The segments, the trigger and the calendar keep their own keys: see [Date Field](/components/date-field#keyboard) and [Range Calendar](/components/range-calendar#keyboard). The picker adds these.

| Key                      | Result                                                                                                                                                                     |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Alt and Down, in a field | Opens the popup. The focus goes to the day that has the tab stop.                                                                                                          |
| Enter, Space             | On the trigger, opens the popup. On a day, picks it. The second pick closes the popup, unless `closeOnSelect` is `false`.                                                  |
| Escape                   | Closes the popup and gives the focus back to the trigger. With the focus in the calendar, it first puts back the range from before the first press of a range in progress. |
| Tab                      | Moves through the popup in the order of the page, after the trigger.                                                                                                       |

## Accessibility

- `DateRangePicker.Trigger` has `aria-haspopup="dialog"` and no name of its own. Give it content or an `aria-label`, such as `Choose dates`, or `Change dates` with the `text` of its slots, as in the [sample of Date Picker](/components/date-picker#accessibility).
- `DateRangePicker.StartField` and `DateRangePicker.EndField` have `role="group"` and no name of their own. The label of a `Field` joins the `aria-label` of each field: the `aria-labelledby` of the group holds the `id` of the group and the `id` of the label, so the name is `Start date Trip dates`. The `aria-labelledby` of a field replaces both.
- `DateRangePicker.Popup` has `role="dialog"`. Give it a name with `aria-label` or `Popover.Title`.
- When the popup opens, the focus goes to the day that has the tab stop: the first day of the range, else today. When it closes, the focus goes back to the trigger. Give `initialFocus` to `DateRangePicker.Popup` to move the focus to another element, or `false` to move none.
- A picker that is `disabled`, in a disabled fieldset or `readonly` has a disabled trigger, and Alt and Down does nothing.

## Portal target

Set `to` on `Popover.Portal` to select a target. For example, `to="#overlays"` selects the element with that ID. See [Portal targets](/components/dialog#portal-targets).

## API reference

<ApiReference />

## Additional types

### DateRangePicker.Root.ChangeEventReason

<ApiReference name="DateRangePicker.Root.ChangeEventReason" />

### DateRangePicker.Root.OpenChangeEventReason

<ApiReference name="DateRangePicker.Root.OpenChangeEventReason" />
