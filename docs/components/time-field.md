---
order: 1
description: An unstyled Vue time field component that edits a Temporal time in one segment for each part.
---

<script setup lang="ts">
import ApiReference from '../.vitepress/components/ApiReference.vue';
import BaseUiDifferences from '../.vitepress/components/BaseUiDifferences.vue';
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

A field with one segment for each part of a time, such as the hour and the minute.

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

- **The field needs `Temporal`**: Load a `Temporal` polyfill for an engine that has none, such as Safari and Node.js 24. Use TypeScript 6.0, or set `skipLibCheck`. See [Dates and times](/handbook/dates-and-times).
- **Form controls must have an accessible name**: Put the field in a `Field` with a `Field.Label`, give `TimeField.Root` an `aria-label` or an `aria-labelledby`, or point a `<label for>` at the `id` of the root. A `<label for>` names the field only after the mount, so the server HTML has no name for it. See the [forms guide](/handbook/forms).
- **The clear button must have a name**: `TimeField.Clear` has no content and no name of its own. Give it content and an `aria-label` in the language of the page.

## Anatomy

Import the component and assemble its parts:

<<< ./time-field/Anatomy.vue

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

Give `min` and `max` to limit the time, and `step` to set the step of the time in seconds. A `max` before `min` gives a range through midnight. An earlier time gives `rangeUnderflow`, and a later time gives `rangeOverflow`. A time that is not a multiple of the step from `min`, or from midnight with no `min`, gives `stepMismatch`. Some empty segments give `badInput`, as in a native time input.

Put the field in a `Field` to show these errors with `Field.Error` and its `match`. The browser finds the limits and the step of a `Temporal.PlainTime`, because its form input has the type `time`. The field finds each other failure itself, and sets it as a custom error of the form input with the message of the browser. `Field.Error` reads it as a native failure. Outside a `Field`, `inputElement.validity.customError` is then `true`, and `validationMessage` says which failure it is.

### Clear button

`TimeField.Clear` empties the field and gives the focus to the first segment. Call `clear()` on the ref of the root to empty the field from your code.

### Render on the server

Give the field a `locale`, or a `LocaleProvider` around it, with the locale of the page. The field does not read the locale of the visitor, so the server HTML and the first render of the browser agree. See [Dates and times](/handbook/dates-and-times#servers).

A server and a browser can have other `Intl` data for one locale, such as another hour cycle. The browser then shows its own layout after the mount. When that layout has another number of parts, Vue can log `Hydration completed but contains mismatches` one time, and the DOM is correct. An element in the `element` slot of a part, or a component in `as`, keeps the attributes of the server.

## Keyboard

| Key                              | Action                                                                                                                                                                 |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tab, Shift+Tab                   | Moves the focus to the next or the previous segment. Each segment is a stop of the Tab key.                                                                            |
| Left, Right                      | Moves the focus to the segment before or after. The keys swap in a right-to-left document.                                                                             |
| Up, Down                         | Adds or takes 1, and wraps in the range of the segment. An empty segment takes its number from `referenceDate`, else from midnight. A day period changes to the other. |
| Page Up, Page Down               | Adds or takes 2 for an hour, and 15 for a minute or a second.                                                                                                          |
| Home, End                        | Sets the least or the greatest number of the segment.                                                                                                                  |
| A digit                          | Adds the digit, also a digit of the numbering system of the locale. The focus goes to the next segment when the segment is full, or when no digit can make a number.   |
| A letter                         | In a day period segment, selects the period whose text starts with that letter.                                                                                        |
| Backspace, Delete                | Empties the segment. Backspace in an empty segment moves the focus to the segment before.                                                                              |
| Ctrl+V or Cmd+V                  | Fills the segments from an ISO 8601 text, or from a text in the layout of the locale.                                                                                  |
| Enter                            | Submits the form, as in a native time input.                                                                                                                           |
| Other keys with Ctrl, Alt or Cmd | Do their native actions.                                                                                                                                               |

## API reference

<ApiReference />

### TimeField.Root.Granularity

The units that the `granularity` prop takes.

<ApiReference name="TimeField.Root.Granularity" />

### TimeField.Root.ChangeEventReason

The reason of `valueChange`: `input-change` for typed text, `keyboard` for a key such as Up or Backspace, and `input-clear` for deletion by an input method.

<ApiReference name="TimeField.Root.ChangeEventReason" />

## Differences from Base UI

<BaseUiDifferences />
