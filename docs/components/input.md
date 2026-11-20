---
order: 1
description: An unstyled Vue input component that works with Field.
---

<script setup lang="ts">
import ApiReference from '../.vitepress/components/ApiReference.vue';
import BaseUiDifferences from '../.vitepress/components/BaseUiDifferences.vue';
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

Import the component:

<<< ./input/Anatomy.vue

## API reference

<ApiReference />

## Differences from Base UI

<BaseUiDifferences />
