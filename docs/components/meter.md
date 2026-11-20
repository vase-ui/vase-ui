---
order: 1
description: An unstyled Vue meter component that provides a graphical display of a numeric value.
---

<script setup lang="ts">
import ApiReference from '../.vitepress/components/ApiReference.vue';
import BaseUiDifferences from '../.vitepress/components/BaseUiDifferences.vue';
import DemoFrame from '../.vitepress/components/DemoFrame.vue';
import DemoSource from '../.vitepress/components/DemoSource.vue';
import DemoMeterHero from '../demos/meter/hero/css-modules/index.vue';
import DemoMeterHeroTailwind from '../demos/meter/hero/tailwind/index.vue';
</script>

# Meter

A graphical display of a numeric value within a range.

<DemoFrame>
  <DemoMeterHero />
  <template #tailwind>
    <DemoMeterHeroTailwind />
  </template>
</DemoFrame>

<DemoSource variant="css-modules">

::: code-group

<<< ../demos/meter/hero/css-modules/index.vue

<<< ../demos/meter/hero/css-modules/index.module.css

:::

</DemoSource>

<DemoSource variant="tailwind">

::: code-group

<<< ../demos/meter/hero/tailwind/index.vue

:::

</DemoSource>

## Anatomy

Import the component and assemble its parts:

<<< ./meter/Anatomy.vue

## API reference

<ApiReference />

## Differences from Base UI

<BaseUiDifferences />
