---
order: 1
description: An unstyled Vue toggle component that displays a two-state button that can be on or off.
---

<script setup lang="ts">
import ApiReference from '../.vitepress/components/ApiReference.vue';
import BaseUiDifferences from '../.vitepress/components/BaseUiDifferences.vue';
import DemoFrame from '../.vitepress/components/DemoFrame.vue';
import DemoSource from '../.vitepress/components/DemoSource.vue';
import DemoToggleHero from '../demos/toggle/hero/css-modules/index.vue';
import DemoToggleHeroTailwind from '../demos/toggle/hero/tailwind/index.vue';
</script>

# Toggle

A two-state button that can be on or off.

<DemoFrame>
  <DemoToggleHero />
  <template #tailwind>
    <DemoToggleHeroTailwind />
  </template>
</DemoFrame>

<DemoSource variant="css-modules">

::: code-group

<<< ../demos/toggle/hero/css-modules/index.vue

<<< ../demos/toggle/hero/css-modules/index.module.css

:::

</DemoSource>

<DemoSource variant="tailwind">

::: code-group

<<< ../demos/toggle/hero/tailwind/index.vue

:::

</DemoSource>

## Anatomy

Import the component and use it as a single part:

<<< ./toggle/Anatomy.vue

## API reference

<ApiReference />

## Differences from Base UI

<BaseUiDifferences />
