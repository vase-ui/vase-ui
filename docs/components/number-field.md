---
order: 1
description: An unstyled Vue number field component with increment and decrement buttons, and a scrub area.
---

<script setup lang="ts">
import ApiReference from '../.vitepress/components/ApiReference.vue';
import DemoFrame from '../.vitepress/components/DemoFrame.vue';
import DemoSource from '../.vitepress/components/DemoSource.vue';
import DemoNumberFieldHero from '../demos/number-field/hero/css-modules/index.vue';
import DemoNumberFieldHeroTailwind from '../demos/number-field/hero/tailwind/index.vue';
</script>

# Number Field

A numeric input element with increment and decrement buttons, and a scrub area.

<DemoFrame>
  <DemoNumberFieldHero />
  <template #tailwind>
    <DemoNumberFieldHeroTailwind />
  </template>
</DemoFrame>

<DemoSource variant="css-modules">

::: code-group

<<< ../demos/number-field/hero/css-modules/index.vue

<<< ../demos/number-field/hero/css-modules/index.module.css

:::

</DemoSource>

<DemoSource variant="tailwind">

::: code-group

<<< ../demos/number-field/hero/tailwind/index.vue

:::

</DemoSource>

## Usage guidelines

- **Form controls must have an accessible name**: Give the input a `<label>` element, or put the number field in a `Field`. See the [forms guide](/handbook/forms).

## Anatomy

Import the component and assemble its parts:

<<< ./number-field/Anatomy.vue

`NumberField.Root` renders a `<div>`. Its last child is a hidden `<input type="number">`, so the root is one element, and a rule of `<style scoped>`, `v-show` and `<Transition>` reach it. `NumberField.Input` renders an `<input type="text" role="spinbutton">`, and the buttons render a `<button>`. A part outside `NumberField.Root` throws an error.

Give the input an `id`, and give a `<label>` the same `for`. In a `Field`, the label of the field names the input. The buttons have no text of their own: give each one a text or an `aria-label`.

## Value

Bind the value with `v-model`, or give `defaultValue` to an uncontrolled root. `null` is an empty field. A change emits `valueChange` and then `update:modelValue`. To keep the value, call `details.cancel()` in `valueChange`. The `reason` of the details says what changed the value. This root refuses each paste:

```vue-html
<NumberField.Root @value-change="(value, details) => details.reason === 'input-paste' && details.cancel()">
```

The root emits `valueCommitted` when the user ends a change: at the blur after typed edits, at a key or a wheel step, at the release of a button or a scrub area, and at a fill.

The text is the value in the format of `format` and `locale`. With no `locale` prop, the text has the locale of the nearest [`LocaleProvider`](/utils/locale-provider), else `en-US`, on the server and in the browser. Text that the user types stays as typed while it is the value, and the blur gives it the format. With a rounding option in `format`, the blur rounds the typed number.

## Steps and the form

The arrow keys, the buttons, the wheel with `allowWheelScrub` and the scrub area step the value. A step is `step`, `smallStep` with Alt or `largeStep` with Shift. Home and End go to `min` and `max`. With `snapOnStep`, a step gives a multiple of its amount, counted from `min`, or from 0 with no `min`.

A form submits the number of the hidden input, not the text of the input. With a number in `step`, the browser accepts only the multiples of `step` from `min`. With no `min`, the browser counts the multiples from the value, so each value is valid. With no `step`, or `'any'`, a step is 1 and the form accepts each number. A typed number goes into the range, unless `allowOutOfRange` lets the form report it.

A reset of the form puts the field back to `defaultValue`, or to the model of its mount. The root then emits only `update:modelValue`.

## Scrub area

A press on `NumberField.ScrubArea` and a move of the pointer step the value: one step for each `pixelSensitivity` px on the axis of `orientation`. A horizontal move toward the end of the line, or a move up, steps up. The drag stops at the edge of the screen.

Style the cursor with CSS. To keep the cursor during a drag out of the area, select the root while it has `data-scrubbing`:

```css
.ScrubArea {
  cursor: ew-resize;
}

html:has([data-scrubbing]) {
  cursor: ew-resize;
}
```

## Styling

Select the states of the parts with these selectors:

| Selector                  | Part                  | State                                                 |
| ------------------------- | --------------------- | ----------------------------------------------------- |
| `:disabled`               | Input, buttons        | The field is disabled. A button is also at its bound. |
| `:read-only`              | Input                 | The field is read-only.                               |
| `:required`               | Input                 | The field is required.                                |
| `[aria-invalid="true"]`   | Input                 | The field is invalid, or the value is out of range.   |
| `:focus`, `:focus-within` | Input; root and group | The input has the focus.                              |

The parts have these attributes:

| Attribute                                                 | Parts                            |
| --------------------------------------------------------- | -------------------------------- |
| `data-scrubbing`                                          | Each part                        |
| `data-disabled`                                           | Root, group, scrub area          |
| `data-readonly`, `data-required`, `data-invalid`          | Root, group, scrub area, buttons |
| `data-valid`, `data-touched`, `data-dirty`, `data-filled` | Each part                        |

## API reference

<ApiReference />
