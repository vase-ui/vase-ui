---
order: 1
description: An unstyled Vue input component that works with Field.
---

<script setup lang="ts">
import ApiReference from '../.vitepress/components/ApiReference.vue';
import DemoFrame from '../.vitepress/components/DemoFrame.vue';
import DemoSource from '../.vitepress/components/DemoSource.vue';
import DemoInputHero from '../demos/input/hero/css-modules/index.vue';
import DemoInputHeroTailwind from '../demos/input/hero/tailwind/index.vue';
</script>

# Input

A native input element that works with [Field](/components/field).

<DemoFrame>
  <DemoInputHero />
  <template #tailwind>
    <DemoInputHeroTailwind />
  </template>
</DemoFrame>

<DemoSource variant="css-modules">

::: code-group

<<< ../demos/input/hero/css-modules/index.vue

<<< ../demos/input/hero/css-modules/index.module.css

:::

</DemoSource>

<DemoSource variant="tailwind">

::: code-group

<<< ../demos/input/hero/tailwind/index.vue

:::

</DemoSource>

## Usage guidelines

- **Form controls must have an accessible name**: Give the input a `<label>` element, or put it in a `Field`. See the [forms guide](/handbook/forms).

## Anatomy

Import the component and use it as a single part:

<<< ./input/Anatomy.vue

`Input` renders one `<input>`. Each attribute and listener that you give goes to the input, such as `type`, `placeholder` and `required`.

Bind the text with `v-model`, or give `defaultValue` to an uncontrolled input. Each edit emits `valueChange` and then `update:modelValue`. To keep the text, call `details.cancel()` in `valueChange`.

In a `Field`, the input is the control of the field. The field gets its value and its state, and validates it. A native reset of the form puts an uncontrolled input back to its first text, and emits only `update:*`.

## Styling

Select the states of the input with these selectors:

| Selector                | State                                                   |
| ----------------------- | ------------------------------------------------------- |
| `:disabled`             | The input is disabled.                                  |
| `:read-only`            | The input is read-only.                                 |
| `:placeholder-shown`    | The input is empty and shows its placeholder.           |
| `[data-filled]`         | The input has text. This selector applies in a `Field`. |
| `[data-valid]`          | The field is valid.                                     |
| `[aria-invalid="true"]` | The field is invalid.                                   |
| `[data-touched]`        | The focus left the input.                               |
| `[data-dirty]`          | The text differs from the first text.                   |

## API reference

<ApiReference />
