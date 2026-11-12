---
order: 1
description: An unstyled Vue separator component that is accessible to screen readers.
---

<script setup lang="ts">
import ApiReference from '../.vitepress/components/ApiReference.vue';
import DemoFrame from '../.vitepress/components/DemoFrame.vue';
import DemoSeparatorHero from '../demos/separator/hero/css-modules/index.vue';
</script>

# Separator

A separator element that is accessible to screen readers.

<DemoFrame>
  <DemoSeparatorHero />
</DemoFrame>

::: code-group

<<< ../demos/separator/hero/css-modules/index.vue

<<< ../demos/separator/hero/css-modules/index.module.css

:::

## Anatomy

Import the component and use it as a single part:

<<< ./separator/Anatomy.vue

## API reference

<ApiReference />
