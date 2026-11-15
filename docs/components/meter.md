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

In the server HTML, a root with no `aria-label` has the id of `Meter.Label` in `aria-labelledby`, when the label has no `id` prop. A label that has an `id` prop names the root only after the root is mounted. To name the root in the server HTML too, give the root an `aria-labelledby` with that id. Until the root is mounted, a root with no label and no `aria-label` has an `aria-labelledby` with an id that no element has. A page with no client code never mounts the root, so the attribute stays. The attribute gives the root no name. Give such a root an `aria-label`, and the server HTML has no `aria-labelledby`.

## API reference

<ApiReference />
