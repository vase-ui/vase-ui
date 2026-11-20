---
order: 1
description: An unstyled Vue date field with a segment for each part of a date, on the Temporal API.
---

<script setup lang="ts">
import ApiReference from '../.vitepress/components/ApiReference.vue';
import DemoFrame from '../.vitepress/components/DemoFrame.vue';
import DemoSource from '../.vitepress/components/DemoSource.vue';
import DemoDateFieldClear from '../demos/date-field/clear/css-modules/index.vue';
import DemoDateFieldClearTailwind from '../demos/date-field/clear/tailwind/index.vue';
import DemoDateFieldDateTime from '../demos/date-field/date-time/css-modules/index.vue';
import DemoDateFieldDateTimeTailwind from '../demos/date-field/date-time/tailwind/index.vue';
import DemoDateFieldHero from '../demos/date-field/hero/css-modules/index.vue';
import DemoDateFieldHeroTailwind from '../demos/date-field/hero/tailwind/index.vue';
import DemoDateFieldMonthYear from '../demos/date-field/month-year/css-modules/index.vue';
import DemoDateFieldMonthYearTailwind from '../demos/date-field/month-year/tailwind/index.vue';
import DemoDateFieldTimeZone from '../demos/date-field/time-zone/css-modules/index.vue';
import DemoDateFieldTimeZoneTailwind from '../demos/date-field/time-zone/tailwind/index.vue';
import DemoDateFieldValidation from '../demos/date-field/validation/css-modules/index.vue';
import DemoDateFieldValidationTailwind from '../demos/date-field/validation/tailwind/index.vue';
</script>

# Date Field

A date field has one segment for each part of a date, such as the month, the day and the year.

Base UI has no date field. This one follows the [spinbutton pattern](https://www.w3.org/WAI/ARIA/apg/patterns/spinbutton/) of the WAI-ARIA Authoring Practices Guide. Its types need TypeScript 6.0, or `skipLibCheck`. The [dates and times guide](/handbook/dates-and-times) has the details, and the polyfill for an engine with no `Temporal`.

<DemoFrame>
  <DemoDateFieldHero />
  <template #tailwind>
    <DemoDateFieldHeroTailwind />
  </template>
</DemoFrame>

<DemoSource variant="css-modules">

::: code-group

<<< ../demos/date-field/hero/css-modules/index.vue

<<< ../demos/date-field/hero/css-modules/index.module.css

:::

</DemoSource>

<DemoSource variant="tailwind">

::: code-group

<<< ../demos/date-field/hero/tailwind/index.vue

:::

</DemoSource>

## Usage guidelines

- **Form controls must have an accessible name**: Put the field in a `Field` with a `Field.Label`, give `DateField.Root` an `aria-label` or an `aria-labelledby`, or point a `<label for>` at the `id` of the root. A native label names the group after the mount, so the server HTML has no name for it. See the [forms guide](/handbook/forms).

## Anatomy

Import the component and assemble its parts:

<<< ./date-field/Anatomy.vue

`DateField.Root` renders one `<div role="group">`. Its last child is the form input: a hidden native `<input>` with the `name`, the value and the native validation of the field, so a form submits the date one time. The segments have no `name`. Read `inputElement` on the root ref after mount to get the form input. Each attribute of the root goes to the group, but `id` goes to the first segment.

`DateField.Input` renders the layout of the locale: a segment for each part of the date, and the text between them. With no `segment` slot, it renders each part with no class. Use the slot to give a class to a segment and to a separator. The slot gets each part of the layout and its `index`. A part that the user edits has `editable: true`. The other parts have `editable: false` and a `text`: a separator, an era or the name of a time zone.

A segment is an `<input type="text" role="spinbutton">`. Its `size` attribute fits its greatest number and its placeholder. To make the box follow the text, add `field-sizing: content` to your styles. Chrome 123, Firefox 152 and Safari 26.2 have it, and an older browser keeps the width of `size`.

To render your own element for a part, use its `element` slot. The slot of `DateField.Input` also gets the `segments` of the layout to render.

## Value

The value is a `Temporal` object, and `v-model` gives back the same kind. The field has a value only when each segment has a number, and it is `null` before that.

| Kind                      | Segments                  | Default granularity |
| ------------------------- | ------------------------- | ------------------- |
| `Temporal.PlainDate`      | Year, month and day       | `day`               |
| `Temporal.PlainDateTime`  | A date and a time         | `minute`            |
| `Temporal.ZonedDateTime`  | A date, a time and a zone | `minute`            |
| `Temporal.PlainYearMonth` | Year and month            | `month`             |

An emitted value keeps the calendar, the time and the time zone of the value that you gave. With no value, the `granularity` prop gives the kind of the value that the field makes: `day` gives a `Temporal.PlainDate`, `month` gives a `Temporal.PlainYearMonth`, and each other unit gives a `Temporal.PlainDateTime`. Use `referenceDate` to give the kind, the time zone and the numbers that an empty segment takes when the user presses an arrow key.

Use `calendar` to show the date in another calendar, and `hourCycle` to give a time the 12-hour or the 24-hour cycle. The value keeps its own calendar. The locale gives only the calendar in which the field shows the date, never the calendar of the value. A field with no `modelValue`, `defaultValue` or `referenceDate` makes a value in the ISO calendar. The exception is an empty year and month field whose `calendar` prop names a calendar with other months than ISO, such as `persian` or `hebrew`. It makes its value in that calendar, because an ISO year and month does not show in that calendar. See the [guide](/handbook/dates-and-times#calendars).

## Examples

### Date and time

A `Temporal.PlainDateTime` value adds the hour and the minute. A locale with a 12-hour cycle adds the day period. Set `granularity` to `second` to add the seconds.

<DemoFrame>
  <DemoDateFieldDateTime />
  <template #tailwind>
    <DemoDateFieldDateTimeTailwind />
  </template>
</DemoFrame>

<DemoSource variant="css-modules">

::: code-group

<<< ../demos/date-field/date-time/css-modules/index.vue

<<< ../demos/date-field/date-time/css-modules/index.module.css

:::

</DemoSource>

<DemoSource variant="tailwind">

::: code-group

<<< ../demos/date-field/date-time/tailwind/index.vue

:::

</DemoSource>

### Time zones

A `Temporal.ZonedDateTime` value shows the name of its time zone. Set `hideTimeZone` to hide the name. The field keeps the time zone in each value that it gives.

<DemoFrame>
  <DemoDateFieldTimeZone />
  <template #tailwind>
    <DemoDateFieldTimeZoneTailwind />
  </template>
</DemoFrame>

<DemoSource variant="css-modules">

::: code-group

<<< ../demos/date-field/time-zone/css-modules/index.vue

<<< ../demos/date-field/time-zone/css-modules/index.module.css

:::

</DemoSource>

<DemoSource variant="tailwind">

::: code-group

<<< ../demos/date-field/time-zone/tailwind/index.vue

:::

</DemoSource>

### Month and year

A `Temporal.PlainYearMonth` value has no day. A `Temporal.PlainDate` with the `granularity` `month` shows the same two segments, and keeps its day.

<DemoFrame>
  <DemoDateFieldMonthYear />
  <template #tailwind>
    <DemoDateFieldMonthYearTailwind />
  </template>
</DemoFrame>

<DemoSource variant="css-modules">

::: code-group

<<< ../demos/date-field/month-year/css-modules/index.vue

<<< ../demos/date-field/month-year/css-modules/index.module.css

:::

</DemoSource>

<DemoSource variant="tailwind">

::: code-group

<<< ../demos/date-field/month-year/tailwind/index.vue

:::

</DemoSource>

### Validation in a Field

Put the field in a `Field` to show the errors of its validation. The form input has the type of the value:

| Value                     | Form input       | Form text                            | Checks                                 |
| ------------------------- | ---------------- | ------------------------------------ | -------------------------------------- |
| `Temporal.PlainDate`      | `date`           | `2026-11-14`                         | Native                                 |
| `Temporal.PlainDateTime`  | `datetime-local` | `2026-11-14T15:04`                   | Native                                 |
| `Temporal.ZonedDateTime`  | `text`           | `2026-11-14T15:04+09:00[Asia/Tokyo]` | `required` native, the limits by field |
| `Temporal.PlainYearMonth` | `text`           | `2026-11`                            | `required` native, the limits by field |

A `Temporal.PlainDate` in `min` or `max` limits whole days. A limit with a time also limits the time of a field that shows a time. A field that shows no time compares days. A limit in a time zone counts as its local time in the zone of a zoned value. A year and month is in the limits when one of its days is.

For a check that its type cannot make, the field asks a native input that is not in the document, and sets its failure as a custom error of the form input. The message is the message of the browser, in the language of the browser. In a `Field`, `Field.Error` with `match` reads each failure as a native one:

- `badInput`: some segments are empty, as in a native date input.
- `rangeUnderflow` and `rangeOverflow`: a limit, for each kind of value.
- `customError`: a date that `unavailableDates` matches. Give the reason in the content of `<Field.Error match="customError">`.

Outside a `Field`, `inputElement.validity.customError` is `true` for each of these failures, and `validationMessage` says which. A disabled or read-only field is not validated.

<DemoFrame>
  <DemoDateFieldValidation />
  <template #tailwind>
    <DemoDateFieldValidationTailwind />
  </template>
</DemoFrame>

<DemoSource variant="css-modules">

::: code-group

<<< ../demos/date-field/validation/css-modules/index.vue

<<< ../demos/date-field/validation/css-modules/index.module.css

:::

</DemoSource>

<DemoSource variant="tailwind">

::: code-group

<<< ../demos/date-field/validation/tailwind/index.vue

:::

</DemoSource>

### Clear button

`DateField.Clear` is a `<button type="button">`. It empties the field and gives the focus to the first segment. It is disabled while the field is empty, disabled or read-only. It has no content and no name of its own, so give it content and an `aria-label` in the language of the page.

The `clear()` method of the root ref empties each segment. It emits `update:modelValue` with `null` when the field had a value, and no `valueChange`.

<DemoFrame>
  <DemoDateFieldClear />
  <template #tailwind>
    <DemoDateFieldClearTailwind />
  </template>
</DemoFrame>

<DemoSource variant="css-modules">

::: code-group

<<< ../demos/date-field/clear/css-modules/index.vue

<<< ../demos/date-field/clear/css-modules/index.module.css

:::

</DemoSource>

<DemoSource variant="tailwind">

::: code-group

<<< ../demos/date-field/clear/tailwind/index.vue

:::

</DemoSource>

## Server render

The field renders with `renderToString`. The server HTML has the segments, their numbers, the literals and the form input.

The locale of the field is its `locale` prop, else the nearest `LocaleProvider`, else `en-US`, on the server and in the browser. The field never reads the locale of the visitor. No render reads today or the time zone of the runtime either: only an arrow key in an empty segment reads today. So the server HTML and the first render of the browser agree.

A server and a browser can have other `Intl` data for the same locale. The layout of the browser then wins: after the mount, each segment writes its attributes again, and Vue writes the text of each literal. When the layout of the browser has another number of parts, Vue logs one message for a part that compiles to the virtual DOM, `Hydration completed but contains mismatches`, and the DOM is correct.

On a Node.js version before 26, load a `Temporal` polyfill before the server starts. See the [guide](/handbook/dates-and-times#servers).

In three languages, the field takes its layout from another format because of a fault of Node.js 22, 24 and 26. See the same [guide](/handbook/dates-and-times#servers).

## Keyboard

Each segment is a stop of the Tab key. Left and Right swap in a right-to-left document.

| Key                | Result                                                                                                                                              |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Up, Down           | Adds or takes 1 and wraps in the range of the segment. An empty segment takes its number from `referenceDate`, or from today. A year does not wrap. |
| Page Up, Page Down | Adds or takes 5 for a year, 2 for a month, 7 for a day, 2 for an hour, and 15 for a minute or a second.                                             |
| Home, End          | The least and the greatest number of the segment.                                                                                                   |
| Digit              | Adds the digit. The focus goes to the next segment when the segment is full, or when no digit can make a number.                                    |
| Backspace, Delete  | Empties the segment. Backspace in an empty segment moves to the segment before.                                                                     |
| Left, Right        | The segment before or after.                                                                                                                        |
| A letter           | In a day period segment, selects the period whose text starts with that letter. Up and Down toggle the period.                                      |

The digits are those of the numbering system of the locale, such as the digits of `ar-EG`. A paste of an ISO 8601 text, or of a text in the layout of the locale, fills the segments. Enter submits the form, as in a native date input. A key with Control, Alt or Meta keeps its native action.

## Styling

The root, `DateField.Input` and `DateField.Literal` have the attributes `data-empty`, `data-complete`, `data-disabled`, `data-readonly`, `data-required`, `data-invalid`, `data-valid`, `data-touched`, `data-dirty` and `data-filled`. A literal also has `data-type`. A segment has `data-type`, `data-empty`, `data-complete`, `data-valid`, `data-touched`, `data-dirty` and `data-filled`. For the rest of its state, use CSS: `:placeholder-shown`, `:focus`, `:disabled`, `:read-only`, `[aria-required="true"]` and `[aria-invalid="true"]`. `DateField.Clear` matches `:disabled`. A field has the focus when it matches `:focus-within`.

The placeholder of a date segment is the short name of its unit, such as `mo` in `en-US`, and `--` for a time segment and a day period. A `placeholder` attribute on `DateField.Segment` wins.

## Accessibility

- `DateField.Root` has `role="group"`. Its name is the label of a `Field`, the name of `aria-label` or `aria-labelledby`, or else the `<label>` of the first segment.
- A segment is an `<input>` with `role="spinbutton"`. Its name comes from `Intl.DisplayNames`. A month has its name as `aria-valuetext`, and a day period its text. An empty segment has no `aria-valuenow`.
- A separator has `aria-hidden`. An era and a time zone name do not.
- Each segment selects its whole text when it gets the focus or a press.

## API reference

<ApiReference />
