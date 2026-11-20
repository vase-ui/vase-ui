---
order: 1
description: An unstyled Vue radio group component that provides shared state to a series of radio buttons.
---

<script setup lang="ts">
import ApiReference from '../.vitepress/components/ApiReference.vue';
import BaseUiDifferences from '../.vitepress/components/BaseUiDifferences.vue';
import DemoFrame from '../.vitepress/components/DemoFrame.vue';
import DemoSource from '../.vitepress/components/DemoSource.vue';
import DemoRadioGroupHero from '../demos/radio-group/hero/css-modules/index.vue';
import DemoRadioGroupHeroTailwind from '../demos/radio-group/hero/tailwind/index.vue';
</script>

# Radio Group

A group that holds the shared state of a series of radio buttons.

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

Import the components and assemble their parts:

<<< ./radio-group/Anatomy.vue

## Examples

### Labeling a radio group

Label the group with `aria-labelledby` and a sibling label element:

<<< ./radio-group/GroupLabel.vue

A `<label>` around each radio is the simplest way to label it:

<<< ./radio-group/EnclosingLabel.vue{8,11}

A `Fieldset.Legend` names the group in its `Fieldset.Root`. Put each radio in a `Field.Item` with its `Field.Label`:

<<< ./radio-group/FieldsetLegend.vue{11}

### Show a mark

Give the input `appearance: none` and draw the mark with CSS, as the demo does. Or render the input in the `element` slot, and render a mark from `state.checked`:

<<< ./radio-group/MarkInElementSlot.vue

## API reference

<ApiReference />

## Differences from Base UI

<BaseUiDifferences />
