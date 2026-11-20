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

- **Each field must have an accessible name**: A field has the default name `Start date` or `End date`. In a `Field`, the label of the `Field` joins the default name of each field, as in `Start date Trip dates`. The `aria-labelledby` of a field replaces its default name. See the [forms guide](/handbook/forms).
- **The popup must have a name**: Give `DateRangePicker.Popup` an `aria-label`, or put a `DateRangePicker.Title` in it.

## Anatomy

Import the component and assemble its parts:

<<< ./date-range-picker/Anatomy.vue

`DateRangePicker.Root` renders `Popover.Root` and no element of its own. It holds the range and shares it with its parts. `DateRangePicker.StartField` and `DateRangePicker.EndField` render `DateField.Root`, and `DateRangePicker.Calendar` renders `RangeCalendar.Root`. Write the parts of those components inside them, as the pages of [Date Field](/components/date-field) and [Range Calendar](/components/range-calendar) show.

`DateRangePicker.Trigger`, `DateRangePicker.Positioner` and `DateRangePicker.Popup` render `Popover.Trigger`, `Popover.Positioner` and `Popover.Popup`. The other parts of the popup are the parts of [Popover](/components/popover): `DateRangePicker.Portal`, `DateRangePicker.Arrow`, `DateRangePicker.Backdrop`, `DateRangePicker.Close`, `DateRangePicker.Title` and `DateRangePicker.Description`. The positioner puts the popup against the box around the two fields, and against the trigger when the picker has no field.

Each field has a hidden `<input>` after its element. A rule of `<style scoped>` thus does not match the fields, and `v-show` has no effect on them. Use `:deep()`, a CSS module, a `style` binding or `v-if`.

## Value

The value is a range of two `Temporal` objects, the first day and the last day. `v-model` gives back the same kind: a `Temporal.PlainDate`, a `Temporal.PlainDateTime` or a `Temporal.ZonedDateTime`. An end is `null` while it has no value, and `null` is the same as `[null, null]`. A range in progress has its first day and a `null` last day.

The root owns the props that its parts share: `granularity`, `referenceDate`, `hourCycle`, `forceLeadingZeros`, `hideTimeZone`, `minDate`, `maxDate`, `unavailableDates`, `locale`, `calendar`, `timeZone`, `disabled`, `readOnly`, `required` and `form`. Give the props of the range calendar that the root does not own, such as `numberOfMonths`, `minDays`, `maxDays` and `allowNonContiguousRanges`, to `DateRangePicker.Calendar`.

With no value, a new end has the kind that `granularity` and `referenceDate` give, as for [Date Field](/components/date-field#value). With a `granularity` that has a time, or a range with a time, the fields show the time segments. A press on a day keeps the time of the end that it replaces. A picker that the user empties keeps the kind of its last range.

`closeOnSelect` says if the second press in the calendar closes the popup. It is `true`, also for a range with a time, because the popup has no part for a time: the user sets a time in a field. The first press only starts the range. A drag closes the popup too, because it makes the whole range. This is also true for a drag that makes the range that the picker already has, although the calendar gives no change for it. A key that extends the range does not, because the user can extend it more. Escape and a press outside the popup close it.

In a [wrapper of `DateRangePicker.Root`](/handbook/composition#wrap-a-part), give `closeOnSelect` the default `undefined` to keep this behavior.

## In a form

Each field gives its end to a form through its hidden input. Name them with `startName` and `endName`. The hidden inputs have the type of the ends, so `minDate` and `maxDate` give `rangeUnderflow` and `rangeOverflow`, and `required` gives `valueMissing` for each empty end. As in [Date Field](/components/date-field), each field reports a field with some segments empty as `badInput`, a limit that the input type cannot check as `rangeUnderflow` or `rangeOverflow`, and a date that `unavailableDates` matches as `customError`.

The end field is invalid when it is before the first end of the range, or before `minDate`. Its `min` is the later of the two, so its hidden input gives `rangeUnderflow`, also for a zoned value. A change of the first end to a later moment than the last end also makes the end field invalid. A field that shows a time compares the time too, so a time that is before the first time of the same day is invalid. A field that shows no time compares days. Two zoned ends compare by the moment, also when they are in two time zones.

Put the picker in a `Field` to show the errors of its validation. Do not give a `name` to that `Field`: it replaces `startName` and `endName` for both fields. A reset of the form puts an uncontrolled picker back to its default range.

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
| `none`                  | A reset of the form, or a call of `clear()` of a field.  |

| Reason of `openChange` | When                                                                 |
| ---------------------- | -------------------------------------------------------------------- |
| `trigger-press`        | A press on the trigger, and Alt+Down in a field.                     |
| `imperative-action`    | The second press or a drag closes the popup, or a call of `close()`. |
| `escape-key`           | Escape closes the popup.                                             |
| `outside-press`        | A press outside the popup closes it.                                 |
| `close-press`          | A press on `DateRangePicker.Close`.                                  |
| `focus-out`            | The focus leaves a popup that is not modal.                          |

## Server render

The picker renders with `renderToString`. The server HTML has the two fields with their segments and their hidden inputs, and the trigger with its name. It has no popup, also for a picker that is open at the mount, because the portal renders after the mount.

A server does not know the locale of the visitor. With no `locale` prop, the picker uses `en-US` until it mounts, and then the locale of the browser. See [Date Field](/components/date-field#server-render) and [Range Calendar](/components/range-calendar#server-render) for what a server and a browser can show in another way.

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

- `DateRangePicker.Trigger` has `aria-haspopup="dialog"`. Its default name is `Choose dates`. With a range that has two ends, its name is `Change dates,` and the range in full. Give it an `aria-label` to change it.
- `DateRangePicker.StartField` and `DateRangePicker.EndField` have `role="group"`. Their default names are `Start date` and `End date`. The `aria-labelledby` of a field replaces its name. The label of a `Field` joins the name of each field: the `aria-labelledby` of the group holds the `id` of the group and the `id` of the label, so the name is `Start date Trip dates`.
- `DateRangePicker.Popup` has `role="dialog"`. Give it a name with `aria-label` or `DateRangePicker.Title`.
- When the popup opens, the focus goes to the day that has the tab stop: the first day of the range, else today. When it closes, the focus goes back to the trigger. Give `initialFocus` to `DateRangePicker.Popup` to move the focus to another element, or `false` to move none.
- A picker that is `disabled`, in a disabled fieldset or `readOnly` has a disabled trigger, and Alt and Down does nothing.
- The default labels are in English. The dates in them follow the locale.

## Portal target

Set `to` on `DateRangePicker.Portal` to select a target. For example, `to="#overlays"` selects the element with that ID. See [Portal targets](/components/dialog#portal-targets).

## API reference

<ApiReference />

## Additional types

### DateRangePicker.Root.ChangeEventReason

<ApiReference name="DateRangePicker.Root.ChangeEventReason" />

### DateRangePicker.Root.OpenChangeEventReason

<ApiReference name="DateRangePicker.Root.OpenChangeEventReason" />
