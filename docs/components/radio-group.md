---
order: 1
description: An unstyled Vue radio group component that provides shared state to a series of radio buttons.
---

<script setup lang="ts">
import ApiReference from '../.vitepress/components/ApiReference.vue';
import DemoFrame from '../.vitepress/components/DemoFrame.vue';
import DemoSource from '../.vitepress/components/DemoSource.vue';
import DemoRadioGroupHero from '../demos/radio-group/hero/css-modules/index.vue';
import DemoRadioGroupHeroTailwind from '../demos/radio-group/hero/tailwind/index.vue';
</script>

# Radio Group

Provides shared state to a series of radio buttons.

<DemoFrame>
  <DemoRadioGroupHero />
  <template #tailwind>
    <DemoRadioGroupHeroTailwind />
  </template>
</DemoFrame>

<DemoSource variant="css-modules">

::: code-group

<<< ../demos/radio-group/hero/css-modules/index.vue

<<< ../demos/radio-group/hero/css-modules/index.module.css

:::

</DemoSource>

<DemoSource variant="tailwind">

::: code-group

<<< ../demos/radio-group/hero/tailwind/index.vue

:::

</DemoSource>

## Usage guidelines

- **Form controls must have an accessible name**: Name the group with `aria-labelledby`, a `Field.Label` or a `Fieldset.Legend`. Name each radio with a `<label>` element, or with a `Field.Label` in a `Field.Item`. See [Labeling a radio group](#labeling-a-radio-group) and the [forms guide](/handbook/forms).

## Anatomy

Radio Group works with Radio. Import the components and assemble their parts:

<<< ./radio-group/Anatomy.vue

`RadioGroup` renders a `<div role="radiogroup">`, and each `Radio` renders one `<input type="radio">` with the `name` of the group. A `Radio` outside a `RadioGroup` throws an error.

Bind the value with `v-model`, or give `defaultValue` to an uncontrolled group. A selection emits `valueChange` and then `update:modelValue`. To keep the value, call `details.cancel()` in `valueChange`.

The group is one tab stop: the checked radio that is enabled, or else the first enabled radio. The arrow keys move the focus and select the radio. With Ctrl, Alt or Meta, an arrow key selects nothing, so the browser keeps its shortcuts. In a read-only group, and on a read-only radio, the arrow keys move the focus and select nothing.

`required` on the group or on one radio makes the group required, as HTML says. A read-only radio, or a radio of a read-only group, has no `required` attribute.

A native reset of the form puts an uncontrolled group back to its first value, and emits only `update:*`.

## Styling

Select the states of a radio with these selectors:

| Selector          | State                                      |
| ----------------- | ------------------------------------------ |
| `:checked`        | The radio is selected.                     |
| `:not(:checked)`  | The radio is not selected.                 |
| `:disabled`       | The radio is disabled.                     |
| `:required`       | The group is required.                     |
| `[data-readonly]` | The radio is read-only.                    |
| `:focus-visible`  | The radio has the focus from the keyboard. |

Select the states of the group with `[aria-disabled="true"]`, `[aria-readonly="true"]`, `[aria-required="true"]`, `[aria-invalid="true"]`, `[data-valid]`, `[data-touched]`, `[data-dirty]` and `[data-filled]`.

## Examples

### Labeling a radio group

Label the group with `aria-labelledby` and a sibling label element:

<<< ./radio-group/GroupLabel.vue

A `<label>` around each radio is the simplest way to label it:

<<< ./radio-group/EnclosingLabel.vue{8,11}

A `Fieldset.Legend` names the group in its `Fieldset.Root`. Put each radio in a `Field.Item` with its `Field.Label`:

<<< ./radio-group/FieldsetLegend.vue{11}

### Showing a mark

Give the input `appearance: none` and draw the mark with CSS, as the demo does. The `element` slot renders the input and gives its state. Render a mark from `state.checked`:

<<< ./radio-group/MarkInElementSlot.vue

## API reference

<ApiReference />
