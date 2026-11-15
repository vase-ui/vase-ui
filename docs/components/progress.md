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

In the server HTML, a root with no `aria-label` has the id of `Progress.Label` in `aria-labelledby`, when the label has no `id` prop. A label that has an `id` prop names the root only after the root is mounted. To name the root in the server HTML too, give the root an `aria-labelledby` with that id. Until the root is mounted, a root with no label and no `aria-label` has an `aria-labelledby` with an id that no element has. A page with no client code never mounts the root, so the attribute stays. The attribute gives the root no name. Give such a root an `aria-label`, and the server HTML has no `aria-labelledby`.

## API reference

<ApiReference />
