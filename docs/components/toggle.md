---
order: 1
description: An unstyled Vue toggle component that displays a two-state button that can be on or off.
---

<script setup lang="ts">
import ApiReference from '../.vitepress/components/ApiReference.vue';
import DemoFrame from '../.vitepress/components/DemoFrame.vue';
import DemoToggleHero from '../demos/toggle/hero/css-modules/index.vue';
</script>

# Toggle

A two-state button that can be on or off.

<DemoFrame>
  <DemoToggleHero />
</DemoFrame>

::: code-group

<<< ../demos/toggle/hero/css-modules/index.vue

<<< ../demos/toggle/hero/css-modules/index.module.css

:::

## Anatomy

Import the component and use it as a single part:

<<< ./toggle/Anatomy.vue

## API reference

<ApiReference />
