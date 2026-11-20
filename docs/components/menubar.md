---
order: 1
description: An unstyled Vue menu bar component that provides commands and options for your application.
---

<script setup lang="ts">
import ApiReference from '../.vitepress/components/ApiReference.vue';
import BaseUiDifferences from '../.vitepress/components/BaseUiDifferences.vue';
import DemoFrame from '../.vitepress/components/DemoFrame.vue';
import DemoSource from '../.vitepress/components/DemoSource.vue';
import DemoMenubarHero from '../demos/menubar/hero/css-modules/index.vue';
import DemoMenubarHeroTailwind from '../demos/menubar/hero/tailwind/index.vue';
</script>

# Menubar

A menu bar that provides commands and options for your application.

<DemoFrame>
  <DemoMenubarHero />
  <template #tailwind>
    <DemoMenubarHeroTailwind />
  </template>
</DemoFrame>

<DemoSource variant="css-modules">

::: code-group

<<< ../demos/menubar/hero/css-modules/index.vue

<<< ../demos/menubar/hero/css-modules/index.module.css

:::

</DemoSource>

<DemoSource variant="tailwind">

::: code-group

<<< ../demos/menubar/hero/tailwind/index.vue

:::

</DemoSource>

## Anatomy

Import the component and assemble its parts:

<<< ./menubar/Anatomy.vue

## API reference

<ApiReference />

## Differences from Base UI

<BaseUiDifferences />
