---
order: 1
description: An unstyled Vue number field component with increment and decrement buttons, and a scrub area.
---

<script setup lang="ts">
import ApiReference from '../.vitepress/components/ApiReference.vue';
import BaseUiDifferences from '../.vitepress/components/BaseUiDifferences.vue';
import DemoFrame from '../.vitepress/components/DemoFrame.vue';
import DemoSource from '../.vitepress/components/DemoSource.vue';
import DemoNumberFieldHero from '../demos/number-field/hero/css-modules/index.vue';
import DemoNumberFieldHeroTailwind from '../demos/number-field/hero/tailwind/index.vue';
</script>

# Number Field

A number input with an increment button, a decrement button and a scrub area.

<DemoFrame>
  <DemoNumberFieldHero />
  <template #tailwind>
    <DemoNumberFieldHeroTailwind />
  </template>
</DemoFrame>

<DemoSource variant="css-modules">

::: code-group

<<< ../demos/number-field/hero/css-modules/index.vue

<<< ../demos/number-field/hero/css-modules/index.module.css

:::

</DemoSource>

<DemoSource variant="tailwind">

::: code-group

<<< ../demos/number-field/hero/tailwind/index.vue

:::

</DemoSource>

## Usage guidelines

- **Form controls must have an accessible name**: Give the input a `<label>` element, or put the number field in a `Field`. Give each button a text or an `aria-label`. See the [forms guide](/handbook/forms).

## Anatomy

Import the component and assemble its parts:

<<< ./number-field/Anatomy.vue

## API reference

<ApiReference />

## Differences from Base UI

<BaseUiDifferences />
