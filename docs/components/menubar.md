---
order: 1
description: An unstyled Vue menu bar component that provides commands and options for your application.
---

<script setup lang="ts">
import ApiReference from '../.vitepress/components/ApiReference.vue';
import DemoFrame from '../.vitepress/components/DemoFrame.vue';
import DemoSource from '../.vitepress/components/DemoSource.vue';
import DemoMenubarHero from '../demos/menubar/hero/css-modules/index.vue';
import DemoMenubarHeroTailwind from '../demos/menubar/hero/tailwind/index.vue';
</script>

# Menubar

A menu bar that provides commands and options for your application.

<DemoFrame>
  <DemoMenubarHero />
  <template #tailwind>
    <DemoMenubarHeroTailwind />
  </template>
</DemoFrame>

<DemoSource variant="css-modules">

::: code-group

<<< ../demos/menubar/hero/css-modules/index.vue

<<< ../demos/menubar/hero/css-modules/index.module.css

:::

</DemoSource>

<DemoSource variant="tailwind">

::: code-group

<<< ../demos/menubar/hero/tailwind/index.vue

:::

</DemoSource>

## Anatomy

Import the component and assemble its parts:

<<< ./menubar/Anatomy.vue

While a menu of the menubar is open, the pointer on another trigger opens the menu of that trigger. Give a [`Menu.Trigger` wrapper](/handbook/composition#wrap-a-part) the `openOnHover` default `undefined` to keep this behavior.

The trigger of the open menu has `[aria-expanded="true"]`. Style the menubar while a menu is open with `:has([aria-expanded="true"])`, and its axis with `[aria-orientation]`.

## API reference

<ApiReference />
