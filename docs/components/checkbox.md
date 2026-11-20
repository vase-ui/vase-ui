---
order: 1
description: An unstyled Vue checkbox component that is easy to customize.
---

<script setup lang="ts">
import ApiReference from '../.vitepress/components/ApiReference.vue';
import BaseUiDifferences from '../.vitepress/components/BaseUiDifferences.vue';
import DemoFrame from '../.vitepress/components/DemoFrame.vue';
import DemoSource from '../.vitepress/components/DemoSource.vue';
import DemoCheckboxHero from '../demos/checkbox/hero/css-modules/index.vue';
import DemoCheckboxHeroTailwind from '../demos/checkbox/hero/tailwind/index.vue';
</script>

# Checkbox

A native checkbox that you can style.

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

## Examples

### Labeling a checkbox

A `<label>` around the checkbox is the simplest pattern to label it:

<<< ./checkbox/EnclosingLabel.vue{6,9}

A `<label>` beside the checkbox names it with `for` and `id`:

<<< ./checkbox/SiblingLabel.vue{6,7}

### Show a mark

Give the input `appearance: none` and draw the mark with CSS. Or put an element of your own after the input, and select it with `:checked + .mark`:

<<< ./checkbox/MarkBeside.vue

The `element` slot renders the input and gives its state. Render the mark from `state.checked` or `state.indeterminate`:

<<< ./checkbox/MarkInElementSlot.vue

## API reference

<ApiReference />

## Differences from Base UI

<BaseUiDifferences />
