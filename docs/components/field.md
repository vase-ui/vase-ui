---
order: 1
description: An unstyled Vue field component that provides labeling and validation for form controls.
---

<script setup lang="ts">
import ApiReference from '../.vitepress/components/ApiReference.vue';
import DemoFrame from '../.vitepress/components/DemoFrame.vue';
import DemoSource from '../.vitepress/components/DemoSource.vue';
import DemoFieldHero from '../demos/field/hero/css-modules/index.vue';
import DemoFieldHeroTailwind from '../demos/field/hero/tailwind/index.vue';
</script>

# Field

A component that provides labeling and validation for form controls.

<DemoFrame>
  <DemoFieldHero />
  <template #tailwind>
    <DemoFieldHeroTailwind />
  </template>
</DemoFrame>

<DemoSource variant="css-modules">

::: code-group

<<< ../demos/field/hero/css-modules/index.vue

<<< ../demos/field/hero/css-modules/index.module.css

:::

</DemoSource>

<DemoSource variant="tailwind">

::: code-group

<<< ../demos/field/hero/tailwind/index.vue

:::

</DemoSource>

## Anatomy

Import the component and assemble its parts:

<<< ./field/Anatomy.vue

A field has one control, such as an `Input`, a `Checkbox` or a `RadioGroup`: the control that mounted last. A `Field.Label` that is a `<label>` names the control with `for`. A label that the `element` slot renders as another element names the control with `aria-labelledby`, and a click on it moves the focus to the control. A group, such as a `RadioGroup`, gets the label in `aria-labelledby`.

The control has the ids of the descriptions, and of each error that shows, in `aria-describedby`. The parts can be in any order, and the server HTML already has these ids.

The field validates its control at the moments of `validationMode`: `submit` (the default), `blur` or `change`. The native check comes first. When it passes, `validate(value, formValues)` runs, and its strings are the errors. `formValues` has the values of the form of the field, or `{}` with no form. `validationDebounceTime` waits for the last change.

`touched` is true after the focus left the control while the control stayed in the document. `dirty` is true while the value differs from the first value. Bind them with `v-model:touched` and `v-model:dirty`, or let the field track them.

A native reset of the form puts the field back to the state of its mount, and starts no validation.

The template ref of `Field.Root` has `validate()`. Call it to validate the field at once.

### The slot of `Field.Root`

The default slot of `Field.Root` gives `state`, `validity`, `errors`, `value` and `initialValue`. Use it to show a message for one failure:

<<< ./field/RootSlot.vue

## Styling

Each part of the field has these attributes:

| Selector          | State                                                                         |
| ----------------- | ----------------------------------------------------------------------------- |
| `[data-disabled]` | The field is disabled.                                                        |
| `[data-valid]`    | The field is valid.                                                           |
| `[data-invalid]`  | The field is invalid. The control has `[aria-invalid="true"]` in place of it. |
| `[data-touched]`  | The focus left the control.                                                   |
| `[data-dirty]`    | The value differs from the first value.                                       |
| `[data-filled]`   | The control has a value.                                                      |

Select a field that has the focus with `:focus-within`.

## API reference

<ApiReference />
