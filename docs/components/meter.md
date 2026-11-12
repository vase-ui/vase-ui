---
order: 1
description: An unstyled Vue meter component that provides a graphical display of a numeric value.
---

<script setup lang="ts">
import ApiReference from '../.vitepress/components/ApiReference.vue';
import DemoFrame from '../.vitepress/components/DemoFrame.vue';
import DemoMeterHero from '../demos/meter/hero/css-modules/index.vue';
</script>

# Meter

A graphical display of a numeric value within a range.

<DemoFrame>
  <DemoMeterHero />
</DemoFrame>

::: code-group

<<< ../demos/meter/hero/css-modules/index.vue

<<< ../demos/meter/hero/css-modules/index.module.css

:::

## Anatomy

Import the component and assemble its parts:

<<< ./meter/Anatomy.vue

## API reference

<ApiReference />
