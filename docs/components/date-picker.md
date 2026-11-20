---
order: 1
description: An unstyled Vue date picker with a field and a calendar in a popup that share one Temporal value.
---

<script setup lang="ts">
import ApiReference from '../.vitepress/components/ApiReference.vue';
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

A date picker has a field to type a date in and a popup with a calendar to pick one. The two share one value.

Base UI has no date picker. This one follows the [Date Picker Dialog pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/examples/datepicker-dialog/) of the WAI-ARIA Authoring Practices Guide. Its types need TypeScript 6.0, or `skipLibCheck`. The [dates and times guide](/handbook/dates-and-times) has the details, and the polyfill for an engine with no `Temporal`.

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

- **Form controls must have an accessible name**: Put the picker in a `Field` with a `Field.Label`, or give `DatePicker.Field` an `aria-labelledby`. A `<label>` element outside a `Field` does not name the group. See the [forms guide](/handbook/forms).
- **The popup must have a name**: Give `DatePicker.Popup` an `aria-label`, or put a `DatePicker.Title` in it.

## Anatomy

Import the component and assemble its parts:

<<< ./date-picker/Anatomy.vue

`DatePicker.Root` renders `Popover.Root` and no element of its own. It holds the value and shares it with its parts. `DatePicker.Field` renders `DateField.Root`, `DatePicker.Calendar` renders `Calendar.Root`, and `DatePicker.TimeField` renders `TimeField.Root`. Write the parts of those components inside them, as the pages of [Date Field](/components/date-field), [Calendar](/components/calendar) and [Time Field](/components/time-field) show.

`DatePicker.Trigger`, `DatePicker.Positioner` and `DatePicker.Popup` render `Popover.Trigger`, `Popover.Positioner` and `Popover.Popup`. The other parts of the popup are the parts of [Popover](/components/popover): `DatePicker.Portal`, `DatePicker.Arrow`, `DatePicker.Backdrop`, `DatePicker.Close`, `DatePicker.Title` and `DatePicker.Description`. The positioner puts the popup against the field, and against the trigger when the picker has no field.

`DatePicker.Field` and `DatePicker.TimeField` have a hidden `<input>` after their element, so a rule of `<style scoped>` does not match them, and `v-show` has no effect on them. Use `:deep()`, a CSS module, a `style` binding or `v-if`.

## Value

The value is a `Temporal` object, and `v-model` gives back the same kind: a `Temporal.PlainDate`, a `Temporal.PlainDateTime`, a `Temporal.ZonedDateTime` or a `Temporal.PlainYearMonth`. It is `null` while the field has a segment with no number.

The root owns the props that its parts share: `granularity`, `referenceDate`, `hourCycle`, `forceLeadingZeros`, `hideTimeZone`, `minDate`, `maxDate`, `unavailableDates`, `locale`, `calendar`, `timeZone`, `disabled`, `readOnly`, `required`, `name` and `form`. The field gives the value to a form through its hidden input. The calendar and the time field give no value to a form.

With no value, a new value has the kind that `granularity` and `referenceDate` give, as for [Date Field](/components/date-field#value). A day that the user presses in the calendar then makes a value at the time of `referenceDate`, or at midnight. A picker that the user empties keeps the kind of its last value.

`closeOnSelect` says if a selection in the calendar closes the popup. It is `true` for a value with no time. It is `false` for a value with a time, because the user then sets the time. A press on the selected day closes the popup too, although the calendar gives no change for it. Escape and a press outside the popup close it and keep the value.

In a [wrapper of `DatePicker.Root`](/handbook/composition#wrap-a-part), give `closeOnSelect` the default `undefined` to keep this behavior.

## Examples

### Date and time

To pick a date and a time, put a date picker and a [Time Picker](/components/time-picker) side by side. Keep the date and the time each in a ref of its own, and join them with `toPlainDateTime`. A picker gives `null` while its field has an empty segment. With a ref for each part, an empty segment in one field does not change the other field.

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

One picker can also hold a date and a time: with a `granularity` that has a time, or a value with a time, the field shows the time segments and a press on a day keeps the time. `DatePicker.TimeField` then is a time field for that value in the popup, which stays open after a selection, so use `DatePicker.Close` to close it.

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

Put the picker in a `Field` to show the errors of its validation. The hidden input of `DatePicker.Field` has the type of the value, so `minDate` and `maxDate` give `rangeUnderflow` and `rangeOverflow`, and `required` gives `valueMissing`. The picker sets a `customError` for a date that `unavailableDates` matches, as the field does.

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

## Events

The root emits `valueChange` and `update:modelValue` for each change of the value. It emits `openChange` and `update:open` when the popup opens or closes. To run code after the animations of the popup, use the hooks of a `<Transition>` around `Popover.Popup`. A `details.cancel()` in `valueChange` or `openChange` stops the change and its `update` event.

| Reason of `valueChange` | When                                          |
| ----------------------- | --------------------------------------------- |
| `day-press`             | A press or Enter or Space on a day.           |
| `month-press`           | A press on a month cell.                      |
| `input-change`          | Typing or autofill in a segment.              |
| `input-clear`           | The user removes a digit with the text input. |
| `input-paste`           | A paste in a segment.                         |
| `keyboard`              | A key changes a segment.                      |
| `clear-press`           | A press on a clear button.                    |
| `none`                  | A reset of the form, or a call of `clear()`.  |

| Reason of `openChange` | When                                                  |
| ---------------------- | ----------------------------------------------------- |
| `trigger-press`        | A press on the trigger, and Alt+Down in the field.    |
| `imperative-action`    | A selection closes the popup, or a call of `close()`. |
| `escape-key`           | Escape closes the popup.                              |
| `outside-press`        | A press outside the popup closes it.                  |
| `close-press`          | A press on `DatePicker.Close`.                        |
| `focus-out`            | The focus leaves a popup that is not modal.           |

## Server render

The picker renders with `renderToString`. The server HTML has the field with its segments and its hidden input, and the trigger with its name. It has no popup, also for a picker that is open at the mount, because the portal renders after the mount.

A server does not know the locale of the visitor. With no `locale` prop, the picker uses `en-US` until it mounts, and then the locale of the browser. See [Date Field](/components/date-field#server-render) and [Calendar](/components/calendar#server-render) for what a server and a browser can show in another way.

On a Node.js version before 26, load a `Temporal` polyfill before the server starts. See the [guide](/handbook/dates-and-times#servers).

## Keyboard

The segments, the trigger and the calendar keep their own keys: see [Date Field](/components/date-field#keyboard) and [Calendar](/components/calendar#keyboard). The picker adds these.

| Key                        | Result                                                                                                         |
| -------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Alt and Down, in the field | Opens the popup. The focus goes to the day that has the tab stop.                                              |
| Enter, Space               | On the trigger, opens the popup. On a day, selects it and closes the popup, unless `closeOnSelect` is `false`. |
| Escape                     | Closes the popup and gives the focus back to the trigger. The value stays.                                     |
| Tab                        | Moves through the popup in the order of the page, after the trigger.                                           |

## Accessibility

- `DatePicker.Trigger` has `aria-haspopup="dialog"`. Its default name is `Choose date`. With a value, its name is `Change date,` and the full date. Give it an `aria-label` to change it.
- `DatePicker.Popup` has `role="dialog"`. Give it a name with `aria-label` or `DatePicker.Title`.
- When the popup opens, the focus goes to the day that has the tab stop: the selected day, else today. When it closes, the focus goes back to the trigger. Give `initialFocus` to `DatePicker.Popup` to move the focus to another element, or `false` to move none.
- A picker that is `disabled` or `readOnly` has a disabled trigger, and Alt and Down does nothing.
- `DatePicker.TimeField` is not a control of the `Field` that holds the picker. It has no label from that field, so give it an `aria-label`.
- The default labels are in English. The dates in them follow the locale.

## Portal target

Set `to` on `DatePicker.Portal` to select a target. For example, `to="#overlays"` selects the element with that ID. See [Portal targets](/components/dialog#portal-targets).

## API reference

<ApiReference />

## Additional types

### DatePicker.Root.ChangeEventReason

<ApiReference name="DatePicker.Root.ChangeEventReason" />

### DatePicker.Root.OpenChangeEventReason

<ApiReference name="DatePicker.Root.OpenChangeEventReason" />
