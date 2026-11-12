---
order: 1
description: An unstyled Vue progress bar component that displays the status of a task that takes a long time.
---

<script setup lang="ts">
import ApiReference from '../.vitepress/components/ApiReference.vue';
import DemoFrame from '../.vitepress/components/DemoFrame.vue';
import DemoProgressHero from '../demos/progress/hero/css-modules/index.vue';
</script>

# Progress

Displays the status of a task that takes a long time.

<DemoFrame>
  <DemoProgressHero />
</DemoFrame>

::: code-group

<<< ../demos/progress/hero/css-modules/index.vue

<<< ../demos/progress/hero/css-modules/index.module.css

:::

## Anatomy

Import the component and assemble its parts:

<<< ./progress/Anatomy.vue

## API reference

<ApiReference />
