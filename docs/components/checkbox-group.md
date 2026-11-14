---
order: 1
description: An unstyled Vue checkbox group component that provides shared state to a series of checkboxes.
---

<script setup lang="ts">
import ApiReference from '../.vitepress/components/ApiReference.vue';
import DemoFrame from '../.vitepress/components/DemoFrame.vue';
import DemoCheckboxGroupHero from '../demos/checkbox-group/hero/css-modules/index.vue';
import DemoCheckboxGroupNested from '../demos/checkbox-group/nested/css-modules/index.vue';
import DemoCheckboxGroupParent from '../demos/checkbox-group/parent/css-modules/index.vue';
</script>

# Checkbox Group

Provides shared state to a series of checkboxes.

<DemoFrame>
  <DemoCheckboxGroupHero />
</DemoFrame>

::: code-group

<<< ../demos/checkbox-group/hero/css-modules/index.vue

<<< ../demos/checkbox-group/hero/css-modules/index.module.css

:::

## Usage guidelines

- **Form controls must have an accessible name**: Name the group with `aria-labelledby`, a `Field.Label` or a `Fieldset.Legend`. Name each checkbox with a `<label>` element, or with a `Field.Label` in a `Field.Item`. See [Labeling a checkbox group](#labeling-a-checkbox-group).

## Anatomy

Checkbox Group works with [Checkbox](/components/checkbox). Import the components and assemble their parts:

<<< ./checkbox-group/Anatomy.vue

Give each `Checkbox.Root` a `value`. The value of the group lists the values of the checked checkboxes. Bind it with `v-model:value`. The group follows a change that you make in place to a reactive `value`, such as `push` or `splice`.

A checkbox with no `value`, and with no `name` of its own or of its field, keeps its own state. The group does not list it.

A change of a checkbox emits `checkedChange` on the checkbox, then `valueChange` and `update:value` on the group, and then `update:checked` on the checkbox. `checkedChange` and `valueChange` get the same `eventDetails`. To stop the change, call `eventDetails.cancel()` in one of them. The checkbox and the group emit no event after that call.

A reset of the form sets an uncontrolled group to its `defaultValue`. The group emits `valueChange` when the value changes. A controlled group does not change. In a `Field`, a reset clears the error of the field and starts no validation.

In a `Field.Root` with a `name`, a form submits the value of each checked checkbox under that name. A disabled group submits nothing.

In the server HTML, the group already has the id of its `Field.Label` in `aria-labelledby`. The label can come before or after the group.

## Examples

### Labeling a checkbox group

Label the group with `aria-labelledby` and a sibling label element:

<<< ./checkbox-group/GroupLabel.vue

A `<label>` around each checkbox is the simplest way to label it:

<<< ./checkbox-group/EnclosingLabel.vue{8,11}

To name the group with a `Fieldset.Legend`, render the group in the `#render` slot of `Fieldset.Root`. Put each checkbox in a `Field.Item` with its `Field.Label`.

<<< ./checkbox-group/FieldsetLegend.vue{10-13}

### Rendering as a native button

By default, `Checkbox.Root` renders a `<span>` element, so a `<label>` can hold it. Render each checkbox as a native button when a label beside it names it with `for` and `id`.

<<< ./checkbox-group/SiblingLabel.vue{11}

To put a native button in a `<label>`, use the `#render` slot. The hidden input then stays outside the label, and the HTML stays valid.

<<< ./checkbox-group/LabelInRenderSlot.vue{10-15}

### Parent checkbox

To make a checkbox that controls the other checkboxes of a `CheckboxGroup`:

1. Pass an array of all the child checkbox values to the `allValues` prop of `CheckboxGroup`.
2. Add the `parent` prop to the parent `Checkbox.Root`.

The parent checkbox works with a controlled group and with an uncontrolled group. The group sets the [indeterminate](/components/checkbox#api-checkbox-root) state of the parent checkbox when some, but not all, child checkboxes are checked.

When some children, but not all, are checked, the first click on the parent checks all of them. The second click unchecks them. The third click restores the selection that the children had before the first click. A disabled child keeps its state.

The parent has `data-parent` and `aria-controls` with the ids of its children. Its hidden input has no name, so a form gets no value from the parent. In the server HTML, the parent has no `aria-controls`, because each child gives its id after the mount.

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
