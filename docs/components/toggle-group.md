---
order: 1
description: An unstyled Vue toggle group component that provides shared state to a series of toggle buttons.
---

<script setup lang="ts">
import ApiReference from '../.vitepress/components/ApiReference.vue';
import DemoFrame from '../.vitepress/components/DemoFrame.vue';
import DemoToggleGroupHero from '../demos/toggle-group/hero/css-modules/index.vue';
import DemoToggleGroupMultiple from '../demos/toggle-group/multiple/css-modules/index.vue';
</script>

# Toggle Group

Provides a shared state to a series of toggle buttons.

<DemoFrame>
  <DemoToggleGroupHero />
</DemoFrame>

::: code-group

<<< ../demos/toggle-group/hero/css-modules/index.vue

<<< ../demos/toggle-group/hero/css-modules/index.module.css

:::

## Anatomy

Import the component and use it as a single part:

<<< ./toggle-group/Anatomy.vue

## Examples

### Multiple

Set the `multiple` prop to let the user press more than one toggle at a time.

<DemoFrame>
  <DemoToggleGroupMultiple />
</DemoFrame>

::: code-group

<<< ../demos/toggle-group/multiple/css-modules/index.vue

<<< ../demos/toggle-group/multiple/css-modules/index.module.css

:::

## API reference

<ApiReference />
