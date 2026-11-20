---
order: 1
description: An unstyled Vue context menu component that appears at the pointer on right click or long press.
---

<script setup lang="ts">
import ApiReference from '../.vitepress/components/ApiReference.vue';
import BaseUiDifferences from '../.vitepress/components/BaseUiDifferences.vue';
import DemoFrame from '../.vitepress/components/DemoFrame.vue';
import DemoSource from '../.vitepress/components/DemoSource.vue';
import DemoContextMenuHero from '../demos/context-menu/hero/css-modules/index.vue';
import DemoContextMenuHeroTailwind from '../demos/context-menu/hero/tailwind/index.vue';
import DemoContextMenuSubmenu from '../demos/context-menu/submenu/css-modules/index.vue';
import DemoContextMenuSubmenuTailwind from '../demos/context-menu/submenu/tailwind/index.vue';
</script>

# Context Menu

A menu that appears at the pointer on right click or long press.

<DemoFrame>
  <DemoContextMenuHero />
  <template #tailwind>
    <DemoContextMenuHeroTailwind />
  </template>
</DemoFrame>

<DemoSource variant="css-modules">

::: code-group

<<< ../demos/context-menu/hero/css-modules/index.vue

<<< ../demos/context-menu/hero/css-modules/index.module.css

:::

</DemoSource>

<DemoSource variant="tailwind">

::: code-group

<<< ../demos/context-menu/hero/tailwind/index.vue

:::

</DemoSource>

## Usage guidelines

- **Use context menus as an enhancement**: Do not make a context menu the only way to do an action. Users may not find or open a context menu, especially on touch devices or with assistive technology. Always show visible controls for the actions of the context menu.

## Anatomy

Import the component and assemble its parts:

<<< ./context-menu/Anatomy.vue

## Examples

[Menu](/components/menu#examples) has more demos. Many of them apply to the context menu too.

### Nested menu

To make a submenu, put a `ContextMenu.SubmenuRoot` in the parent context menu. Use `ContextMenu.SubmenuTrigger` for the item that opens the nested menu.

<DemoFrame>
  <DemoContextMenuSubmenu />
  <template #tailwind>
    <DemoContextMenuSubmenuTailwind />
  </template>
</DemoFrame>

<DemoSource variant="css-modules">

::: code-group

<<< ../demos/context-menu/submenu/css-modules/index.vue

<<< ../demos/context-menu/submenu/css-modules/index.module.css

:::

</DemoSource>

<DemoSource variant="tailwind">

::: code-group

<<< ../demos/context-menu/submenu/tailwind/index.vue

:::

</DemoSource>

## API reference

<ApiReference />

## Differences from Base UI

<BaseUiDifferences />
