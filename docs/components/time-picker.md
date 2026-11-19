---
order: 1
description: An unstyled Vue time picker with a field and a popup that has a list, columns or a clock face, and one Temporal value.
---

<script setup lang="ts">
import ApiReference from '../.vitepress/components/ApiReference.vue';
import DemoFrame from '../.vitepress/components/DemoFrame.vue';
import DemoSource from '../.vitepress/components/DemoSource.vue';
import DemoTimePickerClock from '../demos/time-picker/clock/css-modules/index.vue';
import DemoTimePickerClockTailwind from '../demos/time-picker/clock/tailwind/index.vue';
import DemoTimePickerColumns from '../demos/time-picker/columns/css-modules/index.vue';
import DemoTimePickerColumnsTailwind from '../demos/time-picker/columns/tailwind/index.vue';
import DemoTimePickerHero from '../demos/time-picker/hero/css-modules/index.vue';
import DemoTimePickerHeroTailwind from '../demos/time-picker/hero/tailwind/index.vue';
</script>

# Time Picker

A time picker has a field to type a time in and a popup to pick one. The popup has a list of times, columns of hours, minutes, seconds and day periods, or a clock face. The field and the popup share one value.

Base UI has no time picker. This one follows the [dialog pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/) of the WAI-ARIA Authoring Practices Guide for its popup, and the [listbox pattern](https://www.w3.org/WAI/ARIA/apg/patterns/listbox/) for its list and its columns. Its types need TypeScript 6.0, or `skipLibCheck`. The [dates and times guide](/handbook/dates-and-times) has the details, and the polyfill for an engine with no `Temporal`.

<DemoFrame>
  <DemoTimePickerHero />
  <template #tailwind>
    <DemoTimePickerHeroTailwind />
  </template>
</DemoFrame>

<DemoSource variant="css-modules">

::: code-group

<<< ../demos/time-picker/hero/css-modules/index.vue

<<< ../demos/time-picker/_index.module.css

:::

</DemoSource>

<DemoSource variant="tailwind">

::: code-group

<<< ../demos/time-picker/hero/tailwind/index.vue

:::

</DemoSource>

## Usage guidelines

- **Form controls must have an accessible name**: Put the picker in a `Field` with a `Field.Label`, or give `TimePicker.Field` an `aria-labelledby`. A `<label>` element outside a `Field` does not name the group. See the [forms guide](/handbook/forms).
- **The popup must have a name**: Give `TimePicker.Popup` an `aria-label`, or put a `TimePicker.Title` in it.

## Anatomy

Import the component and assemble its parts:

<<< ./time-picker/Anatomy.vue

`TimePicker.Root` renders `Popover.Root` and no element of its own. It holds the value and shares it with its parts. `TimePicker.Field` renders `TimeField.Root`, and `TimePicker.Clock` renders `TimeClock.Root`. Write the parts of those components inside them, as the pages of [Time Field](/components/time-field) and [Time Clock](/components/time-clock) show.

`TimePicker.Trigger`, `TimePicker.Positioner` and `TimePicker.Popup` render `Popover.Trigger`, `Popover.Positioner` and `Popover.Popup`. The other parts of the popup are the parts of [Popover](/components/popover): `TimePicker.Portal`, `TimePicker.Arrow`, `TimePicker.Backdrop`, `TimePicker.Close`, `TimePicker.Title` and `TimePicker.Description`. The positioner puts the popup against the field, and against the trigger when the picker has no field.

A popup has one of three ways to pick a time. Use the one that fits, or more than one:

- `TimePicker.List` is a list of times. A press on a `TimePicker.Item` sets the time.
- `TimePicker.Column` is a list of the values of one unit. A press on a `TimePicker.ColumnItem` sets that unit and keeps the other units.
- `TimePicker.Clock` is a clock face. Its parts are the parts of `TimeClock`.

`TimePicker.Field` has a hidden `<input>` after its element, so a rule of `<style scoped>` does not match it, and `v-show` has no effect on it. Use `:deep()`, a CSS module, a `style` binding or `v-if`.

## Value

The value is a `Temporal` object, and `v-model` gives back the same kind: a `Temporal.PlainTime`, a `Temporal.PlainDateTime` or a `Temporal.ZonedDateTime`. A new value keeps the date and the time zone of the present value. It is `null` while the field has a segment with no number.

The root owns the props that its parts share: `granularity`, `referenceDate`, `hourCycle`, `forceLeadingZeros`, `hideTimeZone`, `minTime`, `maxTime`, `locale`, `disabled`, `readOnly`, `required`, `name` and `form`. The field gives the value to a form through its hidden input. The list, the columns and the clock give no value to a form.

With no value, the clock shows the time of `referenceDate`, or midnight, and a pick in a column sets one unit of that time. A new value has the kind, the date and the time zone of the default value, else of the last value that the picker had, else of `referenceDate`. With none of them, it is a `Temporal.PlainTime`.

`minTime` and `maxTime` limit the time. The list starts at `minTime` and ends at `maxTime`. The columns and the clock disable a value that has no time in the limits, and a pick moves the time into them. The hidden input of the field gives `rangeUnderflow` and `rangeOverflow` to a time that the user typed. The `step` of `TimePicker.List` is in minutes. `TimePicker.Field` has its own `step`, the step of its hidden input in seconds, as in [Time Field](/components/time-field).

### Close at a selection

`closeOnSelect` says if a selection closes the popup. A press on a time of the list closes it. The commit of the last view of the clock closes it. A press in a column does not, because the user sets more than one unit. Set `closeOnSelect` on the root to change this for the list, the columns and the clock. Escape and a press outside the popup close it and keep the value.

In a [wrapper of `TimePicker.Root`](/handbook/composition#wrap-a-part), give `closeOnSelect` the default `undefined` to keep this behavior.

## Examples

### Columns

`TimePicker.Column` has a `unit`: `hour`, `minute`, `second` or `dayPeriod`. The `step` prop sets the distance between two values. An hour of a 12-hour cycle goes from 12 to 11, because 12 AM is the first hour of the day. A column of day periods renders nothing in a 24-hour cycle.

<DemoFrame>
  <DemoTimePickerColumns />
  <template #tailwind>
    <DemoTimePickerColumnsTailwind />
  </template>
</DemoFrame>

<DemoSource variant="css-modules">

::: code-group

<<< ../demos/time-picker/columns/css-modules/index.vue

<<< ../demos/time-picker/_index.module.css

:::

</DemoSource>

<DemoSource variant="tailwind">

::: code-group

<<< ../demos/time-picker/columns/tailwind/index.vue

:::

</DemoSource>

### Clock

`TimePicker.Clock` takes the parts of [Time Clock](/components/time-clock). The `granularity` of the picker sets the last view, and a commit of that view closes the popup. The `minuteStep`, `secondStep`, `view` and `defaultView` props are props of the clock. Each time that the popup opens, a clock with no `view` shows `defaultView`, or the hours. It emits `valueCommitted`, `viewChange` and `update:view`, so `v-model:view` works on it. The events of the value go to the root.

<DemoFrame>
  <DemoTimePickerClock />
  <template #tailwind>
    <DemoTimePickerClockTailwind />
  </template>
</DemoFrame>

<DemoSource variant="css-modules">

::: code-group

<<< ../demos/time-picker/clock/css-modules/index.vue

<<< ../demos/time-picker/_index.module.css

:::

</DemoSource>

<DemoSource variant="tailwind">

::: code-group

<<< ../demos/time-picker/clock/tailwind/index.vue

:::

</DemoSource>

## Events

The root emits `valueChange` and `update:modelValue` for each change of the value. It emits `openChange` and `update:open` when the popup opens or closes, and `openChangeComplete` after its animations end. A `details.cancel()` in `valueChange` or `openChange` stops the change and its `update` event.

| Reason of `valueChange` | When                                                               |
| ----------------------- | ------------------------------------------------------------------ |
| `item-press`            | A press, Enter or Space on a time, a column value or a day period. |
| `drag`                  | A press or a drag on the clock face.                               |
| `keyboard`              | A key changes a segment, or a key on the clock face.               |
| `input-change`          | Typing or autofill in a segment, or the range input of the clock.  |
| `input-clear`           | The user removes a digit with the text input.                      |
| `input-paste`           | A paste in a segment.                                              |
| `clear-press`           | A press on a clear button.                                         |
| `none`                  | A reset of the form, or a call of `clear()`.                       |

| Reason of `openChange` | When                                                  |
| ---------------------- | ----------------------------------------------------- |
| `trigger-press`        | A press on the trigger, and Alt+Down in the field.    |
| `imperative-action`    | A selection closes the popup, or a call of `close()`. |
| `escape-key`           | Escape closes the popup.                              |
| `outside-press`        | A press outside the popup closes it.                  |
| `close-press`          | A press on `TimePicker.Close`.                        |
| `focus-out`            | The focus leaves a popup that is not modal.           |

## Server render

The picker renders with `renderToString`. The server HTML has the field with its segments and its hidden input, and the trigger with its name. It has no popup, also for a picker that is open at the mount, because the portal renders after the mount. A list, a column or a clock that is outside a popup has the value in the server HTML.

A server does not know the locale of the visitor. With no `locale` prop, the picker uses `en-US` until it mounts, and then the locale of the browser. See [Time Field](/components/time-field#server-render) and [Time Clock](/components/time-clock#server-render) for what a server and a browser can show in another way.

On a Node.js version before 26, load a `Temporal` polyfill before the server starts. See the [guide](/handbook/dates-and-times#servers).

## Keyboard

The segments, the trigger and the clock keep their own keys: see [Time Field](/components/time-field#keyboard) and [Time Clock](/components/time-clock#keyboard). The picker adds these.

| Key                        | Result                                                                                                      |
| -------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Alt and Down, in the field | Opens the popup. The focus goes to the selected time, or to the clock face.                                 |
| Enter, Space               | On the trigger, opens the popup. On an item, selects it, and closes the popup when the selection closes it. |
| Down Arrow, Up Arrow       | In a list or a column, moves the focus to the next or the previous item. The last item goes to the first.   |
| Home, End                  | In a list or a column, moves the focus to the first or the last item.                                       |
| Tab                        | Moves from one column to the next, and then through the popup in the order of the page.                     |
| Escape                     | Closes the popup and gives the focus back to the trigger. The value stays.                                  |

A key goes over a disabled item.

## Accessibility

- `TimePicker.Trigger` has `aria-haspopup="dialog"`. Its default name is `Choose time`. With a value, its name is `Change time,` and the time. Give it an `aria-label` to change it.
- `TimePicker.Popup` has `role="dialog"`. Give it a name with `aria-label` or `TimePicker.Title`.
- `TimePicker.List` and `TimePicker.Column` are listboxes, and each item is an option with `aria-selected`. The default name of the list is `Time`, and the default name of a column is the name of its unit in the locale. Give them an `aria-label` or an `aria-labelledby` to change it.
- When the popup opens, the focus goes to the first of these parts that the popup has: the selected item of the list or of a column, or the first item when no item is selected, or the clock face. When the popup closes, the focus goes back to the trigger. Give `initialFocus` to `TimePicker.Popup` to move the focus to another element, or `false` to move none.
- A picker that is `disabled` or `readOnly` has a disabled trigger, and Alt and Down does nothing. A list and a column in a picker that the user cannot change have `aria-disabled` or `aria-readonly`, and their items do not select.
- The default names of the trigger and of the list are in English, and the time in the name of the trigger follows the locale. The default name of a column is the name of its unit in the locale.

## Portal target

Set `to` on `TimePicker.Portal` to select a target. For example, `to="#overlays"` selects the element with that ID. See [Portal targets](/components/dialog#portal-targets).

## API reference

<ApiReference />

## Additional types

### TimePicker.Root.ChangeEventReason

<ApiReference name="TimePicker.Root.ChangeEventReason" />

### TimePicker.Root.OpenChangeEventReason

<ApiReference name="TimePicker.Root.OpenChangeEventReason" />

### TimePicker.Column.Unit

<ApiReference name="TimePicker.Column.Unit" />
