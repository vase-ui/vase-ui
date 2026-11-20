---
order: 1
description: An unstyled Vue progress bar component that displays the status of a task that takes a long time.
---

<script setup lang="ts">
import ApiReference from '../.vitepress/components/ApiReference.vue';
import BaseUiDifferences from '../.vitepress/components/BaseUiDifferences.vue';
import DemoFrame from '../.vitepress/components/DemoFrame.vue';
import DemoSource from '../.vitepress/components/DemoSource.vue';
import DemoProgressHero from '../demos/progress/hero/css-modules/index.vue';
import DemoProgressHeroTailwind from '../demos/progress/hero/tailwind/index.vue';
</script>

# Progress

Displays the status of a task that takes a long time.

<DemoFrame>
  <DemoProgressHero />
  <template #tailwind>
    <DemoProgressHeroTailwind />
  </template>
</DemoFrame>

<DemoSource variant="css-modules">

::: code-group

<<< ../demos/progress/hero/css-modules/index.vue

<<< ../demos/progress/hero/css-modules/index.module.css

:::

</DemoSource>

<DemoSource variant="tailwind">

::: code-group

<<< ../demos/progress/hero/tailwind/index.vue

:::

</DemoSource>

## Anatomy

Import the component and assemble its parts:

<<< ./progress/Anatomy.vue

## API reference

<ApiReference />

### Progress.Status

The status of the progress bar.

<ApiReference name="Progress.Status" :heading-level="4" />

## Differences from Base UI

<BaseUiDifferences />
