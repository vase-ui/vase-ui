---
order: 1
description: An unstyled Vue time picker component that shares one Temporal value between a field and a list, columns or a clock face in a popup.
---

<script setup lang="ts">
import ApiReference from '../.vitepress/components/ApiReference.vue';
import BaseUiDifferences from '../.vitepress/components/BaseUiDifferences.vue';
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

A field to type a time in, and a list, columns or a clock face in a popup to pick one.

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

- **The picker needs `Temporal`**: Load a `Temporal` polyfill for an engine that has none, such as Safari and Node.js 24. Use TypeScript 6.0, or set `skipLibCheck`. See [Dates and times](/handbook/dates-and-times).
- **Form controls must have an accessible name**: Put the picker in a `Field` with a `Field.Label`, give `TimePicker.Field` an `aria-label` or an `aria-labelledby`, or point a `<label for>` at the `id` of `TimePicker.Field`. See the [forms guide](/handbook/forms).
- **The trigger must have a name**: Give `TimePicker.Trigger` content or an `aria-label` in the language of the page. See [Show the time in the trigger](#show-the-time-in-the-trigger).
- **The popup and the list must have a name**: Give `TimePicker.Popup` an `aria-label`, or put a `Popover.Title` in it. Give `TimePicker.List` an `aria-label` or an `aria-labelledby` in the language of the page.

## Anatomy

Import the component and assemble its parts:

<<< ./time-picker/Anatomy.vue

## Examples

### Columns

`TimePicker.Column` has a `unit`: `hour`, `minute`, `second` or `dayPeriod`. A press on a value sets that unit, keeps the other units, and leaves the popup open. An hour of a 12-hour cycle goes from 12 to 11, because 12 AM is the first hour of the day. A column of day periods renders nothing in a 24-hour cycle.

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

`TimePicker.Clock` holds the parts of [Time Clock](/components/time-clock). The `granularity` of the picker sets its last view, and a commit of that view closes the popup.

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

### Show the time in the trigger

The `text` of the slots of `TimePicker.Trigger` is the time in the locale, or `undefined` with no value. Show it in the trigger as in the [sample of Date Picker](/components/date-picker#show-the-value-in-the-trigger). Give the element of the text `data-allow-mismatch="text"`, because a server can have other `Intl` data than the browser.

## Keyboard

| Key                                                                                                         | Action                                                                                                                                   |
| ----------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Alt+Down in the field                                                                                       | Opens the popup, and gives the focus to the first list, column or clock in it.                                                           |
| Enter, Space                                                                                                | On the trigger, opens the popup. On an item, selects it, and closes the popup when `closeOnSelect` allows it.                            |
| Down, Up                                                                                                    | In a list or a column, moves the focus to the next or the previous item. The last item goes to the first. A disabled item gets no focus. |
| Home, End                                                                                                   | In a list or a column, moves the focus to the first or the last item.                                                                    |
| Tab                                                                                                         | Moves the focus from one column to the next, and then through the popup in the order of the page.                                        |
| Escape                                                                                                      | Closes the popup and gives the focus back to the trigger. The value stays.                                                               |
| The keys of [Time Field](/components/time-field#keyboard) and [Time Clock](/components/time-clock#keyboard) | Do the same actions in the field and on the clock.                                                                                       |

## API reference

<ApiReference />

### TimePicker.Root.ChangeEventReason

The reason of `valueChange`: `item-press` comes from the list and the columns, `drag` from the clock face, and the other reasons from the field or the clock.

<ApiReference name="TimePicker.Root.ChangeEventReason" />

### TimePicker.Root.OpenChangeEventReason

The reason of `openChange`: Alt+Down in the field gives `trigger-press`, and a pick that closes the popup gives `imperative-action`.

<ApiReference name="TimePicker.Root.OpenChangeEventReason" />

### TimePicker.Column.Unit

The units that the `unit` prop of `TimePicker.Column` takes.

<ApiReference name="TimePicker.Column.Unit" />

## Differences from Base UI

<BaseUiDifferences />
