---
order: 1
description: An unstyled Vue switch component that indicates whether a setting is on or off.
---

<script setup lang="ts">
import ApiReference from '../.vitepress/components/ApiReference.vue';
import DemoFrame from '../.vitepress/components/DemoFrame.vue';
import DemoSource from '../.vitepress/components/DemoSource.vue';
import DemoSwitchHero from '../demos/switch/hero/css-modules/index.vue';
import DemoSwitchHeroTailwind from '../demos/switch/hero/tailwind/index.vue';
</script>

# Switch

A control that indicates whether a setting is on or off.

<DemoFrame>
  <DemoSwitchHero />
  <template #tailwind>
    <DemoSwitchHeroTailwind />
  </template>
</DemoFrame>

<DemoSource variant="css-modules">

::: code-group

<<< ../demos/switch/hero/css-modules/index.vue

<<< ../demos/switch/hero/css-modules/index.module.css

:::

</DemoSource>

<DemoSource variant="tailwind">

::: code-group

<<< ../demos/switch/hero/tailwind/index.vue

:::

</DemoSource>

## Usage guidelines

- **Form controls must have an accessible name**: Give the switch a `<label>` element, or put it in a `Field`. See [Labeling a switch](#labeling-a-switch) and the [forms guide](/handbook/forms).

## Anatomy

Import the component:

<<< ./switch/Anatomy.vue

`Switch` renders one `<input type="checkbox" role="switch">`. The browser gives it the label, the keyboard, the form data and `required`. Each attribute and listener that you give goes to the input.

Bind the checked state with `v-model`, or give `defaultChecked` to an uncontrolled switch. A press emits `checkedChange` and then `update:modelValue`. To keep the state, call `details.cancel()` in `checkedChange`.

`uncheckedValue` gives the form an entry while the switch is off, enabled and has a name. The switch adds the entry in a `formdata` listener of its form, so a submit before the hydration has no entry.

A native reset of the form puts an uncontrolled switch back to its first state, and emits only `update:*`.

## Styling

The input is the element that you style. Select its states with these selectors:

| Selector                 | State                                       |
| ------------------------ | ------------------------------------------- |
| `:checked`               | The switch is on.                           |
| `:not(:checked)`         | The switch is off.                          |
| `:disabled`              | The switch is disabled.                     |
| `:required`              | The switch is required.                     |
| `[aria-readonly="true"]` | The switch is read-only.                    |
| `:focus-visible`         | The switch has the focus from the keyboard. |
| `[data-valid]`           | The field is valid.                         |
| `[aria-invalid="true"]`  | The field is invalid.                       |
| `[data-touched]`         | The focus left the control.                 |
| `[data-dirty]`           | The value differs from the first value.     |

The last four selectors apply in a `Field`.

## Examples

### Labeling a switch

A `<label>` around the switch is the simplest pattern to label it:

<<< ./switch/EnclosingLabel.vue{6,9}

A `<label>` beside the switch names it with `for` and `id`:

<<< ./switch/SiblingLabel.vue{6,7}

### Showing a thumb

Give the input `appearance: none`, and put an element of your own after it for the thumb. Select the thumb with `:checked + .thumb`:

<<< ./switch/ThumbBeside.vue

The `element` slot renders the input and gives its state. Render the thumb from `state.checked`:

<<< ./switch/ThumbInElementSlot.vue

## API reference

<ApiReference />
