---
order: 1
description: An unstyled Vue toggle group component that provides shared state to a series of toggle buttons.
---

<script setup lang="ts">
import ApiReference from '../.vitepress/components/ApiReference.vue';
import BaseUiDifferences from '../.vitepress/components/BaseUiDifferences.vue';
import DemoFrame from '../.vitepress/components/DemoFrame.vue';
import DemoSource from '../.vitepress/components/DemoSource.vue';
import DemoToggleGroupHero from '../demos/toggle-group/hero/css-modules/index.vue';
import DemoToggleGroupHeroTailwind from '../demos/toggle-group/hero/tailwind/index.vue';
import DemoToggleGroupMultiple from '../demos/toggle-group/multiple/css-modules/index.vue';
import DemoToggleGroupMultipleTailwind from '../demos/toggle-group/multiple/tailwind/index.vue';
</script>

# Toggle Group

Provides a shared state to a series of toggle buttons.

<DemoFrame>
  <DemoToggleGroupHero />
  <template #tailwind>
    <DemoToggleGroupHeroTailwind />
  </template>
</DemoFrame>

<DemoSource variant="css-modules">

::: code-group

<<< ../demos/toggle-group/hero/css-modules/index.vue

<<< ../demos/toggle-group/hero/css-modules/index.module.css

:::

</DemoSource>

<DemoSource variant="tailwind">

::: code-group

<<< ../demos/toggle-group/hero/tailwind/index.vue

:::

</DemoSource>

## Anatomy

Import the component and use it as a single part:

<<< ./toggle-group/Anatomy.vue

## Examples

### Multiple

Set the `multiple` prop to let the user press more than one toggle at a time.

<DemoFrame>
  <DemoToggleGroupMultiple />
  <template #tailwind>
    <DemoToggleGroupMultipleTailwind />
  </template>
</DemoFrame>

<DemoSource variant="css-modules">

::: code-group

<<< ../demos/toggle-group/multiple/css-modules/index.vue

<<< ../demos/toggle-group/multiple/css-modules/index.module.css

:::

</DemoSource>

<DemoSource variant="tailwind">

::: code-group

<<< ../demos/toggle-group/multiple/tailwind/index.vue

:::

</DemoSource>

## API reference

<ApiReference />

## Differences from Base UI

<BaseUiDifferences />
