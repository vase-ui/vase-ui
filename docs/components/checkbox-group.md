---
order: 1
description: An unstyled Vue checkbox group component that provides shared state to a series of checkboxes.
---

<script setup lang="ts">
import ApiReference from '../.vitepress/components/ApiReference.vue';
import BaseUiDifferences from '../.vitepress/components/BaseUiDifferences.vue';
import DemoFrame from '../.vitepress/components/DemoFrame.vue';
import DemoSource from '../.vitepress/components/DemoSource.vue';
import DemoCheckboxGroupHero from '../demos/checkbox-group/hero/css-modules/index.vue';
import DemoCheckboxGroupHeroTailwind from '../demos/checkbox-group/hero/tailwind/index.vue';
import DemoCheckboxGroupNested from '../demos/checkbox-group/nested/css-modules/index.vue';
import DemoCheckboxGroupParent from '../demos/checkbox-group/parent/css-modules/index.vue';
</script>

# Checkbox Group

A group that holds the shared state of a series of checkboxes.

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

Import the components and assemble their parts:

<<< ./checkbox-group/Anatomy.vue

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

1. Give the values of all the child checkboxes to the `allValues` prop of `CheckboxGroup`.
2. Give the `parent` prop to the parent `Checkbox`.

The group can be controlled or uncontrolled. The parent checkbox is indeterminate while some, but not all, child checkboxes are checked. Then the first click on the parent checks all of them, the second click clears them, and the third click gives back the selection of the children. A disabled child keeps its state.

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

## Differences from Base UI

<BaseUiDifferences />
