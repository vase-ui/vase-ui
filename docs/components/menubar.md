---
order: 1
description: An unstyled Vue menu bar component that provides commands and options for your application.
---

<script setup lang="ts">
import ApiReference from '../.vitepress/components/ApiReference.vue';
import DemoFrame from '../.vitepress/components/DemoFrame.vue';
import DemoMenubarHero from '../demos/menubar/hero/css-modules/index.vue';
</script>

# Menubar

A menu bar that provides commands and options for your application.

<DemoFrame>
  <DemoMenubarHero />
</DemoFrame>

::: code-group

<<< ../demos/menubar/hero/css-modules/index.vue

<<< ../demos/menubar/hero/css-modules/index.module.css

:::

## Anatomy

Import the component and assemble its parts:

<<< ./menubar/Anatomy.vue

## API reference

<ApiReference />
