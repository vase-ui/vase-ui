---
order: 1
description: An unstyled Vue separator component that is accessible to screen readers.
---

<script setup lang="ts">
import ApiReference from '../.vitepress/components/ApiReference.vue';
import BaseUiDifferences from '../.vitepress/components/BaseUiDifferences.vue';
import DemoFrame from '../.vitepress/components/DemoFrame.vue';
import DemoSource from '../.vitepress/components/DemoSource.vue';
import DemoSeparatorHero from '../demos/separator/hero/css-modules/index.vue';
import DemoSeparatorHeroTailwind from '../demos/separator/hero/tailwind/index.vue';
</script>

# Separator

A separator element that is accessible to screen readers.

<DemoFrame>
  <DemoSeparatorHero />
  <template #tailwind>
    <DemoSeparatorHeroTailwind />
  </template>
</DemoFrame>

<DemoSource variant="css-modules">

::: code-group

<<< ../demos/separator/hero/css-modules/index.vue

<<< ../demos/separator/hero/css-modules/index.module.css

:::

</DemoSource>

<DemoSource variant="tailwind">

::: code-group

<<< ../demos/separator/hero/tailwind/index.vue

:::

</DemoSource>

## Anatomy

Import the component:

<<< ./separator/Anatomy.vue

## API reference

<ApiReference />

## Differences from Base UI

<BaseUiDifferences />
