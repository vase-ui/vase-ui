---
order: 1
description: An unstyled Vue checkbox group component that provides shared state to a series of checkboxes.
---

<script setup lang="ts">
import ApiReference from '../.vitepress/components/ApiReference.vue';
import DemoFrame from '../.vitepress/components/DemoFrame.vue';
import DemoSource from '../.vitepress/components/DemoSource.vue';
import DemoCheckboxGroupHero from '../demos/checkbox-group/hero/css-modules/index.vue';
import DemoCheckboxGroupHeroTailwind from '../demos/checkbox-group/hero/tailwind/index.vue';
import DemoCheckboxGroupNested from '../demos/checkbox-group/nested/css-modules/index.vue';
import DemoCheckboxGroupParent from '../demos/checkbox-group/parent/css-modules/index.vue';
</script>

# Checkbox Group

Provides shared state to a series of checkboxes.

<DemoFrame>
  <DemoCheckboxGroupHero />
  <template #tailwind>
    <DemoCheckboxGroupHeroTailwind />
  </template>
</DemoFrame>

<DemoSource variant="css-modules">

::: code-group

<<< ../demos/checkbox-group/hero/css-modules/index.vue

<<< ../demos/checkbox-group/hero/css-modules/index.module.css

:::

</DemoSource>

<DemoSource variant="tailwind">

::: code-group

<<< ../demos/checkbox-group/hero/tailwind/index.vue

:::

</DemoSource>

## Usage guidelines

- **Form controls must have an accessible name**: Name the group with `aria-labelledby`, a `Field.Label` or a `Fieldset.Legend`. Name each checkbox with a `<label>` element, or with a `Field.Label` in a `Field.Item`. See [Labeling a checkbox group](#labeling-a-checkbox-group) and the [forms guide](/handbook/forms).

## Anatomy

Checkbox Group works with [Checkbox](/components/checkbox). Import the components and assemble their parts:

<<< ./checkbox-group/Anatomy.vue

Give each `Checkbox` a `value`. The `modelValue` of the group is an array of the values of the checked checkboxes. Bind it with `v-model`. A press adds the value at the end, or removes it. The group follows a change that you make in place to a reactive `modelValue`, such as `push` or `splice`. A value with no mounted checkbox stays.

A checkbox with no `value` keeps its own state. The group does not list it.

A press emits `checkedChange` on the checkbox, then `valueChange` and `update:modelValue` on the group. `checkedChange` and `valueChange` get the same `details`. To stop the change, call `details.cancel()` in one of them.

A native reset of the form puts an uncontrolled group back to its first value, and emits only `update:*`.

A form gets one entry for each checked checkbox that has a name and is enabled. In a `Field`, the name is the `name` of the field. The values of a `Form` have the array of the checked, mounted and enabled checkboxes.

## Styling

Select the states of the group with `[data-disabled]`, `[aria-invalid="true"]`, `[data-valid]`, `[data-touched]`, `[data-dirty]` and `[data-filled]`. Select the states of each checkbox as the [Checkbox](/components/checkbox#styling) page says.

## Examples

### Labeling a checkbox group

Label the group with `aria-labelledby` and a sibling label element:

<<< ./checkbox-group/GroupLabel.vue

A `<label>` around each checkbox is the simplest way to label it:

<<< ./checkbox-group/EnclosingLabel.vue{8,11}

A `Fieldset.Legend` names the group in its `Fieldset.Root`. Put each checkbox in a `Field.Item` with its `Field.Label`:

<<< ./checkbox-group/FieldsetLegend.vue{11}

### Parent checkbox

To make a checkbox that controls the other checkboxes of a `CheckboxGroup`:

1. Pass an array of all the child checkbox values to the `allValues` prop of `CheckboxGroup`.
2. Add the `parent` prop to the parent `Checkbox`.

The parent checkbox works with a controlled group and with an uncontrolled group. The group sets the [indeterminate](/components/checkbox#anatomy) state of the parent checkbox when some, but not all, child checkboxes are checked.

When some children, but not all, are checked, the first click on the parent checks all of them. The second click unchecks them. The third click restores the selection that the children had before the first click. A disabled child keeps its state.

The parent has `aria-controls` with the ids of its children. It has no name, so a form gets no value from the parent. In the server HTML, the parent has no `aria-controls`, because each child gives its id after the mount.

<DemoFrame>
  <DemoCheckboxGroupParent />
</DemoFrame>

::: code-group

<<< ../demos/checkbox-group/parent/css-modules/index.vue

<<< ../demos/checkbox-group/parent/css-modules/index.module.css

:::

### Nested parent checkbox

The demo nests a `CheckboxGroup` in another `CheckboxGroup`. Each group has its own value and its own parent checkbox. The demo links the two values in its `valueChange` listeners. It sets `indeterminate` on the outer parent while the inner group has some, but not all, of its checkboxes checked.

<DemoFrame>
  <DemoCheckboxGroupNested />
</DemoFrame>

::: code-group

<<< ../demos/checkbox-group/nested/css-modules/index.vue

<<< ../demos/checkbox-group/nested/css-modules/index.module.css

:::

## API reference

<ApiReference />
