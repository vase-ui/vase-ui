---
order: 1
description: An unstyled Vue fieldset component with an easily stylable legend.
---

<script setup lang="ts">
import ApiReference from '../.vitepress/components/ApiReference.vue';
import DemoFrame from '../.vitepress/components/DemoFrame.vue';
import DemoFieldsetHero from '../demos/fieldset/hero/css-modules/index.vue';
</script>

# Fieldset

A native fieldset element with an easily stylable legend.

<DemoFrame>
  <DemoFieldsetHero />
</DemoFrame>

::: code-group

<<< ../demos/fieldset/hero/css-modules/index.vue

<<< ../demos/fieldset/hero/css-modules/index.module.css

:::

## Anatomy

Import the component and assemble its parts:

<<< ./fieldset/Anatomy.vue

## API reference

<ApiReference />
