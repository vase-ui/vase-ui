---
order: 1
description: An unstyled Vue fieldset component that gives a group of controls a legend that you can style.
---

<script setup lang="ts">
import ApiReference from '../.vitepress/components/ApiReference.vue';
import BaseUiDifferences from '../.vitepress/components/BaseUiDifferences.vue';
import DemoFrame from '../.vitepress/components/DemoFrame.vue';
import DemoSource from '../.vitepress/components/DemoSource.vue';
import DemoFieldsetHero from '../demos/fieldset/hero/css-modules/index.vue';
import DemoFieldsetHeroTailwind from '../demos/fieldset/hero/tailwind/index.vue';
</script>

# Fieldset

A native fieldset element with a legend that you can style.

<DemoFrame>
  <DemoFieldsetHero />
  <template #tailwind>
    <DemoFieldsetHeroTailwind />
  </template>
</DemoFrame>

<DemoSource variant="css-modules">

::: code-group

<<< ../demos/fieldset/hero/css-modules/index.vue

<<< ../demos/fieldset/hero/css-modules/index.module.css

:::

</DemoSource>

<DemoSource variant="tailwind">

::: code-group

<<< ../demos/fieldset/hero/tailwind/index.vue

:::

</DemoSource>

## Anatomy

Import the component and assemble its parts:

<<< ./fieldset/Anatomy.vue

## API reference

<ApiReference />

## Differences from Base UI

<BaseUiDifferences />
