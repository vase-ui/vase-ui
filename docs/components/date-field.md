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

- **Form controls must have an accessible name**: Put the field in a `Field` with a `Field.Label`, or give `DateField.Root` an `id` and a `<label>` element whose `for` is that id. See the [forms guide](/handbook/forms).

## Anatomy

Import the component and assemble its parts:

<<< ./date-field/Anatomy.vue

`DateField.Root` renders its element and a hidden `<input>` after it. The hidden input has the `name` of the field and the native validation, so a form submits the date one time. The segments have no `name`. Read `inputElement` on the root ref after mount to get the hidden input.

`DateField.Input` renders the layout of the locale: a segment for each part of the date, and the text between them. With no `segment` slot, it renders each part with no class. Use the slot to give a class to a segment and to a separator. The slot gets each part of the layout and its `index`. A part that the user edits has `editable: true`. The other parts have `editable: false` and a `text`: a separator, an era or the name of a time zone.

A segment is an `<input>`. The part sets `field-sizing: content` in the `style` of the segment, so the box of a segment follows its text and your styles need no rule for its width. A `width` or a `min-width` in your styles still applies. Chrome and Edge before 123, Firefox before 152 and Safari before 26.2 do not have `field-sizing`. In those browsers the `size` attribute gives the width, and that width is too narrow for `AM` in some fonts. Give the segment a width if you support them. To remove the declaration, see [Inline style attributes](/utils/csp-provider#inline-style-attributes).

Because of the hidden input, `DateField.Root` has more than one root node. A rule of `<style scoped>` does not match its element, and `v-show` has no effect on it. Use `:deep()`, a CSS module, a `style` binding or `v-if`.

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

Put the field in a `Field` to show the errors of its validation. The hidden input has the type of the value, so `minDate` and `maxDate` give `rangeUnderflow` and `rangeOverflow`, and `required` gives `valueMissing`. A `Temporal.PlainDate` limits whole days. A limit with a time, such as a `Temporal.PlainDateTime`, also limits the time of a field that shows a time. A field that shows no time compares days. A zoned limit limits a zoned value by the moment, also in another time zone. The field sets a `customError` for a date that `unavailableDates` matches, for a field with some segments empty, and for the limits that the input type cannot check.

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

`DateField.Clear` empties the field and gives the focus to the first segment. It is disabled while the field is empty, disabled or read-only. With no content and no `#render` slot, it shows `x` and has the `aria-label` `Clear`. With content or a `#render` slot, give the button an `aria-label` of your own.

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

The field renders with `renderToString`. The server HTML has the segments, the numbers and the hidden input value.

A server does not know the locale of the visitor. With no `locale` prop, the field uses `en-US` until it mounts, and then the locale of the browser. Give a `locale` prop to render the same layout in each place.

A server and a browser can have other `Intl` data for the same locale. The layout of the server can then differ from the layout of the browser. While the field hydrates, it marks the elements that can differ. After it mounts, it compares its elements with its layout and makes them again where they differ. The hydration gives no warning.

`DateField.Input` renders its parts in a list of fixed length, with a comment in each place after the last part. A layout with more or fewer parts thus hydrates with no message, also in the `children` component of a `#render` slot.

Digits that a visitor types, or that the browser fills, before the page hydrates stay in the segments. After the hydration, the field takes their numbers. When each segment then has a number, the root emits `valueChange` and `update:modelValue`. When the visitor left a segment before the page hydrated, the segment then also gets `change`, `blur` and `focusout`.

The root also takes a date that a program or the browser writes into its hidden input before the page hydrates. It takes a date that the browser restores after a move back in the history or a reload too. It then emits `valueChange` and `update:modelValue` one time. A `valueChange` listener can thus run after a move back with no action of the visitor.

On a Node.js version before 26, load a `Temporal` polyfill before the server starts. See the [guide](/handbook/dates-and-times#servers).

In three languages, the field takes its layout from another format because of a fault of Node.js 22, 24 and 26. See the same [guide](/handbook/dates-and-times#servers).

## Keyboard

Each segment is a stop of the Tab key. Left and Right swap in a right-to-left document.

| Key                | Result                                                                                                                        |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| Up, Down           | Adds or takes 1 and wraps in the range of the segment. An empty segment takes its number from `referenceDate`, or from today. |
| Page Up, Page Down | Adds or takes 5 for a year, 2 for a month, 7 for a day, 2 for an hour, and 15 for a minute or a second.                       |
| Home, End          | The least and the greatest number of the segment.                                                                             |
| Digit              | Adds the digit. The focus goes to the next segment when the segment is full, or when no digit can make a number.              |
| Backspace, Delete  | Removes the last digit. Backspace in an empty segment moves to the segment before.                                            |
| Left, Right        | The segment before or after.                                                                                                  |
| A letter           | In a day period segment, selects the period whose text starts with that letter. Up and Down toggle the period.                |

The digits are those of the numbering system of the locale, such as the digits of `ar-EG`. A paste of an ISO 8601 text, or of a text in the layout of the locale, fills the segments.

## Accessibility

- `DateField.Root` has `role="group"`. Its name is the label of the field, or the elements of `aria-labelledby`.
- A segment is an `<input>` with `role="spinbutton"`. Its name comes from `Intl.DisplayNames`. A month has its name as `aria-valuetext`, a day period has its text, and a segment with no number has `Empty`.
- A separator has `aria-hidden`. An era and a time zone name do not.
- Each segment selects its whole text when it gets the focus.
- The default `Clear` label is in English. Give the button an `aria-label` to change it.

## API reference

<ApiReference />
