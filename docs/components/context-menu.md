---
order: 1
description: An unstyled Vue context menu component that appears at the pointer on right click or long press.
---

<script setup lang="ts">
import ApiReference from '../.vitepress/components/ApiReference.vue';
import DemoFrame from '../.vitepress/components/DemoFrame.vue';
import DemoContextMenuHero from '../demos/context-menu/hero/css-modules/index.vue';
import DemoContextMenuSubmenu from '../demos/context-menu/submenu/css-modules/index.vue';
</script>

# Context Menu

A menu that appears at the pointer on right click or long press.

<DemoFrame>
  <DemoContextMenuHero />
</DemoFrame>

::: code-group

<<< ../demos/context-menu/hero/css-modules/index.vue

<<< ../demos/context-menu/hero/css-modules/index.module.css

:::

## Usage guidelines

- **Use context menus as an enhancement**: Do not make a context menu the only way to do an action. Users may not find or open a context menu, especially on touch devices or with assistive technology. Always show visible controls for the actions of the context menu.
- **Keyboard**: The trigger has no key handler. A key opens the menu only when the browser sends a `contextmenu` event for that key, as some browsers do for the context menu key.

## Anatomy

Import the component and assemble its parts:

<<< ./context-menu/Anatomy.vue

## Examples

[Menu](/components/menu#examples) shows more examples. Many of them also apply to the context menu.

### Nested menu

To make a submenu, put a `ContextMenu.SubmenuRoot` in the parent context menu. Use `ContextMenu.SubmenuTrigger` for the item that opens the nested menu.

<DemoFrame>
  <DemoContextMenuSubmenu />
</DemoFrame>

::: code-group

<<< ../demos/context-menu/submenu/css-modules/index.vue

<<< ../demos/context-menu/submenu/css-modules/index.module.css

:::

## API reference

<ApiReference />
