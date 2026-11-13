---
order: 1
description: An unstyled Vue input component that works with Field.
---

<script setup lang="ts">
import ApiReference from '../.vitepress/components/ApiReference.vue';
import DemoFrame from '../.vitepress/components/DemoFrame.vue';
import DemoInputHero from '../demos/input/hero/css-modules/index.vue';
</script>

# Input

A native input element that works with Field.

<DemoFrame>
  <DemoInputHero />
</DemoFrame>

::: code-group

<<< ../demos/input/hero/css-modules/index.vue

<<< ../demos/input/hero/css-modules/index.module.css

:::

## Usage guidelines

- **Form controls must have an accessible name**: Give the input a `<label>` element, or put it in a `Field`.

## Anatomy

Import the component and use it as a single part:

<<< ./input/Anatomy.vue

## API reference

<ApiReference />
