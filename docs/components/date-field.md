---
order: 1
description: An unstyled Vue date field component that edits a Temporal date in one segment for each part.
---

<script setup lang="ts">
import ApiReference from '../.vitepress/components/ApiReference.vue';
import BaseUiDifferences from '../.vitepress/components/BaseUiDifferences.vue';
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

A field with one segment for each part of a date, such as the month, the day and the year.

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

- **The field needs `Temporal`**: Load a `Temporal` polyfill for an engine that has none, such as Safari and Node.js 24. Use TypeScript 6.0, or set `skipLibCheck`. See [Dates and times](/handbook/dates-and-times).
- **Form controls must have an accessible name**: Put the field in a `Field` with a `Field.Label`, give `DateField.Root` an `aria-label` or an `aria-labelledby`, or point a `<label for>` at the `id` of the root. A `<label for>` names the field only after the mount, so the server HTML has no name for it. See the [forms guide](/handbook/forms).
- **The clear button must have a name**: `DateField.Clear` has no content and no name of its own. Give it content and an `aria-label` in the language of the page.

## Anatomy

Import the component and assemble its parts:

<<< ./date-field/Anatomy.vue

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

| Value                     | Form input       | Form text                            | Checks                                     |
| ------------------------- | ---------------- | ------------------------------------ | ------------------------------------------ |
| `Temporal.PlainDate`      | `date`           | `2026-11-14`                         | Native                                     |
| `Temporal.PlainDateTime`  | `datetime-local` | `2026-11-14T15:04`                   | Native                                     |
| `Temporal.ZonedDateTime`  | `text`           | `2026-11-14T15:04+09:00[Asia/Tokyo]` | `required` native, the limits by the field |
| `Temporal.PlainYearMonth` | `text`           | `2026-11`                            | `required` native, the limits by the field |

A `Temporal.PlainDate` in `min` or `max` limits whole days. A limit with a time also limits the time of a field that shows a time. A field that shows no time compares days. A limit in a time zone counts as its local time in the zone of a zoned value. A year and month is in the limits when one of its days is.

The field also finds the failures that the type of its form input cannot find. It sets each one as a custom error of the form input, with the message of the browser. `Field.Error` with `match` reads them as native failures:

- `badInput`: some segments are empty, as in a native date input.
- `rangeUnderflow` and `rangeOverflow`: a limit, for each kind of value.
- `customError`: a date that `unavailableDates` matches. Give the reason in the content of `<Field.Error match="customError">`.

Outside a `Field`, `inputElement.validity.customError` is `true` for each of these failures, and `validationMessage` says which.

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

`DateField.Clear` empties the field and gives the focus to the first segment. Call `clear()` on the ref of the root to empty the field from your code.

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

### Render on the server

Give the field a `locale`, or a `LocaleProvider` around it, with the locale of the page. The field does not read the locale of the visitor, so the server HTML and the first render of the browser agree. See [Dates and times](/handbook/dates-and-times#servers).

A server and a browser can have other `Intl` data for one locale. The browser then shows its own layout after the mount. When that layout has another number of parts, Vue can log `Hydration completed but contains mismatches` one time, and the DOM is correct. An element in the `element` slot of a part, or a component in `as`, keeps the attributes of the server.

## Keyboard

| Key                              | Action                                                                                                                                                                                    |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tab, Shift+Tab                   | Moves the focus to the next or the previous segment. Each segment is a stop of the Tab key.                                                                                               |
| Left, Right                      | Moves the focus to the segment before or after. The keys swap in a right-to-left document.                                                                                                |
| Up, Down                         | Adds or takes 1, and wraps in the range of the segment. A year does not wrap. An empty segment takes its number from `referenceDate`, else from today. A day period changes to the other. |
| Page Up, Page Down               | Adds or takes 5 for a year, 2 for a month, 7 for a day, 2 for an hour, and 15 for a minute or a second.                                                                                   |
| Home, End                        | Sets the least or the greatest number of the segment.                                                                                                                                     |
| A digit                          | Adds the digit, also a digit of the numbering system of the locale. The focus goes to the next segment when the segment is full, or when no digit can make a number.                      |
| A letter                         | In a day period segment, selects the period whose text starts with that letter.                                                                                                           |
| Backspace, Delete                | Empties the segment. Backspace in an empty segment moves the focus to the segment before.                                                                                                 |
| Ctrl+V or Cmd+V                  | Fills the segments from an ISO 8601 text, or from a text in the layout of the locale.                                                                                                     |
| Enter                            | Submits the form, as in a native date input.                                                                                                                                              |
| Other keys with Ctrl, Alt or Cmd | Do their native actions.                                                                                                                                                                  |

## API reference

<ApiReference />

### DateField.Root.Granularity

The units that the `granularity` prop takes.

<ApiReference name="DateField.Root.Granularity" />

### DateField.Root.ChangeEventReason

The reason of `valueChange`: `input-change` for typed text, `keyboard` for a key such as Up or Backspace, and `input-clear` for deletion by an input method.

<ApiReference name="DateField.Root.ChangeEventReason" />

## Differences from Base UI

<BaseUiDifferences />
