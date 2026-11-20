---
order: 1
description: An unstyled Vue time field with a segment for each part of a time, on the Temporal API.
---

<script setup lang="ts">
import ApiReference from '../.vitepress/components/ApiReference.vue';
import DemoFrame from '../.vitepress/components/DemoFrame.vue';
import DemoSource from '../.vitepress/components/DemoSource.vue';
import DemoTimeFieldHero from '../demos/time-field/hero/css-modules/index.vue';
import DemoTimeFieldHeroTailwind from '../demos/time-field/hero/tailwind/index.vue';
import DemoTimeFieldHourCycle from '../demos/time-field/hour-cycle/css-modules/index.vue';
import DemoTimeFieldHourCycleTailwind from '../demos/time-field/hour-cycle/tailwind/index.vue';
import DemoTimeFieldSeconds from '../demos/time-field/seconds/css-modules/index.vue';
import DemoTimeFieldSecondsTailwind from '../demos/time-field/seconds/tailwind/index.vue';
</script>

# Time Field

A time field has one segment for each part of a time, such as the hour and the minute.

Base UI has no time field. This one follows the [spinbutton pattern](https://www.w3.org/WAI/ARIA/apg/patterns/spinbutton/) of the WAI-ARIA Authoring Practices Guide. Its types need TypeScript 6.0, or `skipLibCheck`. The [dates and times guide](/handbook/dates-and-times) has the details, and the polyfill for an engine with no `Temporal`.

<DemoFrame>
  <DemoTimeFieldHero />
  <template #tailwind>
    <DemoTimeFieldHeroTailwind />
  </template>
</DemoFrame>

<DemoSource variant="css-modules">

::: code-group

<<< ../demos/time-field/hero/css-modules/index.vue

<<< ../demos/time-field/hero/css-modules/index.module.css

:::

</DemoSource>

<DemoSource variant="tailwind">

::: code-group

<<< ../demos/time-field/hero/tailwind/index.vue

:::

</DemoSource>

## Usage guidelines

- **Form controls must have an accessible name**: Put the field in a `Field` with a `Field.Label`, give `TimeField.Root` an `aria-label` or an `aria-labelledby`, or point a `<label for>` at the `id` of the root. A native label names the group after the mount, so the server HTML has no name for it. See the [forms guide](/handbook/forms).

## Anatomy

Import the component and assemble its parts:

<<< ./time-field/Anatomy.vue

`TimeField.Root` renders one `<div role="group">`. Its last child is the form input: a hidden native `<input>` with the `name`, the value and the native validation of the field, so a form submits the time one time. The segments have no `name`. Read `inputElement` on the root ref after mount to get the form input. Each attribute of the root goes to the group, but `id` goes to the first segment.

`TimeField.Input` renders the layout of the locale: a segment for each part of the time, and the text between them. With no `segment` slot, it renders each part with no class. Use the slot to give a class to a segment and to a separator. The slot gets each part of the layout and its `index`. A part that the user edits has `editable: true`. The other parts have `editable: false` and a `text`: a separator, or the name of a time zone.

A segment is an `<input type="text" role="spinbutton">`. Its `size` attribute fits its greatest number and its placeholder. To make the box follow the text, add `field-sizing: content` to your styles. Chrome 123, Firefox 152 and Safari 26.2 have it, and an older browser keeps the width of `size`.

To render your own element for a part, use its `element` slot. The slot of `TimeField.Input` also gets the `segments` of the layout to render.

## Value

The value is a `Temporal` object, and `v-model` gives back the same kind. The field has a value only when each segment has a number, and it is `null` before that.

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
  <template #tailwind>
    <DemoTimeFieldSecondsTailwind />
  </template>
</DemoFrame>

<DemoSource variant="css-modules">

::: code-group

<<< ../demos/time-field/seconds/css-modules/index.vue

<<< ../demos/time-field/seconds/css-modules/index.module.css

:::

</DemoSource>

<DemoSource variant="tailwind">

::: code-group

<<< ../demos/time-field/seconds/tailwind/index.vue

:::

</DemoSource>

### Hour cycle

A 12-hour cycle adds a day period segment. The locale sets where the segment goes: after the minute in `en-US`, and before the hour in `ko-KR`. A 24-hour cycle has no day period.

<DemoFrame>
  <DemoTimeFieldHourCycle />
  <template #tailwind>
    <DemoTimeFieldHourCycleTailwind />
  </template>
</DemoFrame>

<DemoSource variant="css-modules">

::: code-group

<<< ../demos/time-field/hour-cycle/css-modules/index.vue

<<< ../demos/time-field/hour-cycle/css-modules/index.module.css

:::

</DemoSource>

<DemoSource variant="tailwind">

::: code-group

<<< ../demos/time-field/hour-cycle/tailwind/index.vue

:::

</DemoSource>

### Limits and steps

Give `min` and `max` to limit the time. A `max` before `min` gives a range through midnight. The form input of a `Temporal.PlainTime` has the type `time`, so an earlier time gives `rangeUnderflow` and a later time gives `rangeOverflow`. The `step` prop is the step of the time, in seconds. A time that is not a multiple of the step from `min`, or from midnight with no `min`, gives `stepMismatch`. Put the field in a `Field` to show these errors with `Field.Error` and its `match`.

For a value that has a date, the form input has the type `datetime-local` with the date and the time, or the type `text` for a value in a time zone. The field then asks a native `time` input that is not in the document for `min`, `max` and `step`, and sets its failure as a custom error of the form input, with the message of the browser. `Field.Error` with `match` reads it as `rangeUnderflow`, `rangeOverflow` or `stepMismatch`.

A field with some segments empty has the failure `badInput`, as a native time input reports it. Outside a `Field`, `inputElement.validity.customError` is `true` for each failure that the field finds, and `validationMessage` says which.

### Clear button

`TimeField.Clear` is a `<button type="button">`. It empties the field and gives the focus to the first segment. It is disabled while the field is empty, disabled or read-only. It has no content and no name of its own, so give it content and an `aria-label` in the language of the page.

The `clear()` method of the root ref empties each segment. It emits `update:modelValue` with `null` when the field had a value, and no `valueChange`.

## Server render

The field renders with `renderToString`. The server HTML has the segments, their numbers, the literals and the form input.

The locale of the field is its `locale` prop, else the nearest `LocaleProvider`, else `en-US`, on the server and in the browser. The field never reads the locale of the visitor, so the server HTML and the first render of the browser agree. Give the locale of your app to render it.

A server and a browser can have other `Intl` data for the same locale, such as another hour cycle. The layout of the browser then wins: after the mount, each segment writes its attributes again, and Vue writes the text of each literal. When the layout of the browser has another number of parts, Vue logs one message for a part that compiles to the virtual DOM, `Hydration completed but contains mismatches`, and the DOM is correct.

On a Node.js version before 26, load a `Temporal` polyfill before the server starts. See the [guide](/handbook/dates-and-times#servers).

## Keyboard

Each segment is a stop of the Tab key. Left and Right swap in a right-to-left document.

| Key                | Result                                                                                                                           |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| Up, Down           | Adds or takes 1 and wraps in the range of the segment. An empty segment takes its number from `referenceDate`, or from midnight. |
| Page Up, Page Down | Adds or takes 2 for an hour, and 15 for a minute or a second.                                                                    |
| Home, End          | The least and the greatest number of the segment.                                                                                |
| Digit              | Adds the digit. The focus goes to the next segment when the segment is full, or when no digit can make a number.                 |
| Backspace, Delete  | Empties the segment. Backspace in an empty segment moves to the segment before.                                                  |
| Left, Right        | The segment before or after.                                                                                                     |
| A letter           | In a day period segment, selects the period whose text starts with that letter. Up and Down toggle the period.                   |

The digits are those of the numbering system of the locale, such as the digits of `ar-EG`. A paste of an ISO 8601 text, or of a text in the layout of the locale, fills the segments. Enter submits the form, as in a native time input. A key with Control, Alt or Meta keeps its native action.

## Styling

The root, `TimeField.Input` and `TimeField.Literal` have the attributes `data-empty`, `data-complete`, `data-disabled`, `data-readonly`, `data-required`, `data-invalid`, `data-valid`, `data-touched`, `data-dirty` and `data-filled`. A literal also has `data-type`. A segment has `data-type`, `data-empty`, `data-complete`, `data-valid`, `data-touched`, `data-dirty` and `data-filled`. For the rest of its state, use CSS: `:placeholder-shown`, `:focus`, `:disabled`, `:read-only`, `[aria-required="true"]` and `[aria-invalid="true"]`. `TimeField.Clear` matches `:disabled`. A field has the focus when it matches `:focus-within`.

The placeholder of each segment is `--`. A `placeholder` attribute on `TimeField.Segment` wins.

## Accessibility

- `TimeField.Root` has `role="group"`. Its name is the label of a `Field`, the name of `aria-label` or `aria-labelledby`, or else the `<label>` of the first segment.
- A segment is an `<input>` with `role="spinbutton"`. Its name comes from `Intl.DisplayNames`. A day period has its text as `aria-valuetext`. An empty segment has no `aria-valuenow`.
- A separator has `aria-hidden`. The name of a time zone does not.
- Each segment selects its whole text when it gets the focus or a press.

## API reference

<ApiReference />
