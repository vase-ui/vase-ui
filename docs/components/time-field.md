---
order: 1
description: An unstyled Vue time field with a segment for each part of a time, on the Temporal API.
---

<script setup lang="ts">
import ApiReference from '../.vitepress/components/ApiReference.vue';
import DemoFrame from '../.vitepress/components/DemoFrame.vue';
import DemoTimeFieldHero from '../demos/time-field/hero/css-modules/index.vue';
import DemoTimeFieldHourCycle from '../demos/time-field/hour-cycle/css-modules/index.vue';
import DemoTimeFieldSeconds from '../demos/time-field/seconds/css-modules/index.vue';
</script>

# Time Field

A time field has one segment for each part of a time, such as the hour and the minute.

Base UI has no time field. This one follows the [spinbutton pattern](https://www.w3.org/WAI/ARIA/apg/patterns/spinbutton/) of the WAI-ARIA Authoring Practices Guide. Its types need TypeScript 6.0, or `skipLibCheck`. The [dates and times guide](/handbook/dates-and-times) has the details, and the polyfill for an engine with no `Temporal`.

<DemoFrame>
  <DemoTimeFieldHero />
</DemoFrame>

::: code-group

<<< ../demos/time-field/hero/css-modules/index.vue

<<< ../demos/time-field/hero/css-modules/index.module.css

:::

## Usage guidelines

- **Form controls must have an accessible name**: Give the field a `<label>` element, or put it in a `Field`. See the [forms guide](/handbook/forms).

## Anatomy

Import the component and assemble its parts:

<<< ./time-field/Anatomy.vue

`TimeField.Root` renders its element and a hidden `<input>` after it. The hidden input has the `name` of the field and the native validation, so a form submits the time one time. The segments have no `name`.

`TimeField.Input` renders the layout of the locale: a segment for each part of the time, and the text between them. With no `segment` slot, it renders each part with no class. Use the slot to give a class to a segment and to a separator. The slot gets each part of the layout and its `index`. A part that the user edits has `editable: true`. The other parts have `editable: false` and a `text`: a separator, or the name of a time zone.

Because of the hidden input, `TimeField.Root` has more than one root node. A rule of `<style scoped>` does not match its element, and `v-show` has no effect on it. Use `:deep()`, a CSS module, a `style` binding or `v-if`.

## Value

The value is a `Temporal` object, and `v-model:value` gives back the same kind. The field has a value only when each segment has a number, and it is `null` before that.

| Kind                     | What the field shows                                                 |
| ------------------------ | -------------------------------------------------------------------- |
| `Temporal.PlainTime`     | The time.                                                            |
| `Temporal.PlainDateTime` | The time. The date stays in the value.                               |
| `Temporal.ZonedDateTime` | The time and the name of the time zone. The date stays in the value. |

An emitted value keeps the date, the calendar and the time zone of the value that you gave. With no value, no `defaultValue` and no `referenceDate`, the field makes a `Temporal.PlainTime`. Give a `referenceDate` of another kind to make that kind, and to give the date, the time zone and the numbers that an empty segment takes when the user presses an arrow key.

The `granularity` prop sets the last part that the field shows: `hour`, `minute` (the default) or `second`. The `hourCycle` prop sets the 12-hour or the 24-hour cycle. The default cycle is the cycle of the locale.

## Examples

### Seconds

Set `granularity` to `second` to add the seconds.

<DemoFrame>
  <DemoTimeFieldSeconds />
</DemoFrame>

::: code-group

<<< ../demos/time-field/seconds/css-modules/index.vue

<<< ../demos/time-field/seconds/css-modules/index.module.css

:::

### Hour cycle

A 12-hour cycle adds a day period segment. The locale sets where the segment goes: after the minute in `en-US`, and before the hour in `ko-KR`. A 24-hour cycle has no day period.

<DemoFrame>
  <DemoTimeFieldHourCycle />
</DemoFrame>

::: code-group

<<< ../demos/time-field/hour-cycle/css-modules/index.vue

<<< ../demos/time-field/hour-cycle/css-modules/index.module.css

:::

### Limits and steps

Give `minTime` and `maxTime` to limit the time. The hidden input has the type `time`, so an earlier time gives `rangeUnderflow` and a later time gives `rangeOverflow`. The `step` prop is the `step` of the hidden input, in seconds. A time that is not a multiple of the step from `minTime`, or from midnight with no `minTime`, gives `stepMismatch`. Put the field in a `Field` to show these errors.

For a value that has a date, the hidden input has the type `datetime-local`, or a text for a value in a time zone. The field then sets a `customError` for a time outside `minTime` and `maxTime`. It also sets a `customError` for a field with some segments empty.

### Clear button

`TimeField.Clear` empties the field and gives the focus to the first segment. It is disabled while the field is empty, disabled or read-only. With no content it shows `x` and has the `aria-label` `Clear`. With content, give the button an `aria-label` of your own.

## Server render

The field renders with `renderToString`. The server HTML has the segments, the numbers and the hidden input value.

A server does not know the locale of the visitor. With no `locale` prop, the field uses `en-US` until it mounts, and then the locale of the browser. Give a `locale` prop to render the same layout in each place.

A server and a browser can have other `Intl` data for the same locale. The layout of the server can then differ from the layout of the browser, also in the number of its parts. The field marks the elements that can differ while it hydrates. After it mounts, the field compares its elements with its layout and makes them again where they differ. The hydration gives no warning.

On a Node.js version before 26, load a `Temporal` polyfill before the server starts. See the [guide](/handbook/dates-and-times#servers).

## Keyboard

Each segment is a stop of the Tab key. Left and Right swap in a right-to-left document.

| Key                | Result                                                                                                           |
| ------------------ | ---------------------------------------------------------------------------------------------------------------- |
| Up, Down           | Adds or takes 1 and wraps in the range of the segment. An empty segment takes its number from `referenceDate`.   |
| Page Up, Page Down | Adds or takes 2 for an hour, and 15 for a minute or a second.                                                    |
| Home, End          | The least and the greatest number of the segment.                                                                |
| Digit              | Adds the digit. The focus goes to the next segment when the segment is full, or when no digit can make a number. |
| Backspace, Delete  | Removes the last digit. Backspace in an empty segment moves to the segment before.                               |
| Left, Right        | The segment before or after.                                                                                     |
| A letter           | In a day period segment, selects the period whose text starts with that letter. Up and Down toggle the period.   |

The digits are those of the numbering system of the locale, such as the digits of `ar-EG`. A paste of an ISO 8601 text, or of a text in the layout of the locale, fills the segments.

## Accessibility

- `TimeField.Root` has `role="group"`. Its name is the label of the field, or the elements of `aria-labelledby`.
- A segment is an `<input>` with `role="spinbutton"`. Its name comes from `Intl.DisplayNames`, and its `aria-valuetext` is the name of the day period, or `Empty`.
- A separator has `aria-hidden`. The name of a time zone does not.
- Each segment selects its whole text when it gets the focus.
- The default `Clear` label is in English. Give the button an `aria-label` to change it.

## API reference

<ApiReference />
