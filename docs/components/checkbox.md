---
order: 1
description: An unstyled Vue checkbox component that is easy to customize.
---

<script setup lang="ts">
import ApiReference from '../.vitepress/components/ApiReference.vue';
import DemoFrame from '../.vitepress/components/DemoFrame.vue';
import DemoSource from '../.vitepress/components/DemoSource.vue';
import DemoCheckboxHero from '../demos/checkbox/hero/css-modules/index.vue';
import DemoCheckboxHeroTailwind from '../demos/checkbox/hero/tailwind/index.vue';
</script>

# Checkbox

An easily stylable checkbox component.

<DemoFrame>
  <DemoCheckboxHero />
  <template #tailwind>
    <DemoCheckboxHeroTailwind />
  </template>
</DemoFrame>

<DemoSource variant="css-modules">

::: code-group

<<< ../demos/checkbox/hero/css-modules/index.vue

<<< ../demos/checkbox/hero/css-modules/index.module.css

:::

</DemoSource>

<DemoSource variant="tailwind">

::: code-group

<<< ../demos/checkbox/hero/tailwind/index.vue

:::

</DemoSource>

## Usage guidelines

- **Form controls must have an accessible name**: Give the checkbox a `<label>` element, or put it in a `Field`. See [Labeling a checkbox](#labeling-a-checkbox) and the [forms guide](/handbook/forms).

## Anatomy

Import the component:

<<< ./checkbox/Anatomy.vue

`Checkbox` renders one `<input type="checkbox">`. The browser gives it the label, the keyboard, the form data and `required`. Each attribute and listener that you give goes to the input.

Bind the checked state with `v-model`, or give `defaultChecked` to an uncontrolled checkbox. A press emits `checkedChange` and then `update:modelValue`. To keep the state, call `details.cancel()` in `checkedChange`.

`indeterminate` is a state beside `checked`. A press asks to clear it with `update:indeterminate`, so `v-model:indeterminate` follows the press. The server HTML has `data-indeterminate`, and the input gets its `indeterminate` property after the mount.

`uncheckedValue` gives the form an entry while the checkbox is unchecked, enabled and has a name. The checkbox adds the entry in a `formdata` listener of its form, so a submit before the hydration has no entry. A checkbox in a `CheckboxGroup` ignores `uncheckedValue`.

A native reset of the form puts an uncontrolled checkbox back to its first state, and emits only `update:*`.

## Styling

The input is the element that you style. Select its states with these selectors:

| Selector                 | State                                                                    |
| ------------------------ | ------------------------------------------------------------------------ |
| `:checked`               | The checkbox is checked.                                                 |
| `:not(:checked)`         | The checkbox is not checked.                                             |
| `[data-indeterminate]`   | The checkbox is indeterminate. `:indeterminate` matches after the mount. |
| `:disabled`              | The checkbox is disabled.                                                |
| `:required`              | The checkbox is required.                                                |
| `[aria-readonly="true"]` | The checkbox is read-only.                                               |
| `:focus-visible`         | The checkbox has the focus from the keyboard.                            |
| `[data-valid]`           | The field is valid.                                                      |
| `[aria-invalid="true"]`  | The field is invalid.                                                    |
| `[data-touched]`         | The focus left the control.                                              |
| `[data-dirty]`           | The value differs from the first value.                                  |

The last four selectors apply in a `Field`.

## Examples

### Labeling a checkbox

A `<label>` around the checkbox is the simplest pattern to label it:

<<< ./checkbox/EnclosingLabel.vue{6,9}

A `<label>` beside the checkbox names it with `for` and `id`:

<<< ./checkbox/SiblingLabel.vue{6,7}

### Showing a mark

Give the input `appearance: none` and draw the mark with CSS. Or put an element of your own after the input, and select it with `:checked + .mark`:

<<< ./checkbox/MarkBeside.vue

The `element` slot renders the input and gives its state. Render the mark from `state.checked` or `state.indeterminate`:

<<< ./checkbox/MarkInElementSlot.vue

## API reference

<ApiReference />
