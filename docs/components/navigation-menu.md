---
order: 1
description: An unstyled Vue navigation menu component that shows a collection of links and menus for website navigation.
---

<script setup lang="ts">
import ApiReference from '../.vitepress/components/ApiReference.vue';
import DemoFrame from '../.vitepress/components/DemoFrame.vue';
import DemoNavigationMenuHero from '../demos/navigation-menu/hero/css-modules/index.vue';
import DemoNavigationMenuNested from '../demos/navigation-menu/nested/css-modules/index.vue';
import DemoNavigationMenuNestedInline from '../demos/navigation-menu/nested-inline/css-modules/index.vue';
</script>

# Navigation Menu

A collection of links and menus for website navigation.

<DemoFrame>
  <DemoNavigationMenuHero />
</DemoFrame>

::: code-group

<<< ../demos/navigation-menu/hero/css-modules/index.vue

<<< ../demos/navigation-menu/hero/css-modules/index.module.css

:::

## Anatomy

Import the component and assemble its parts:

<<< ./navigation-menu/Anatomy.vue

## Examples

### Nested submenus

Put a `NavigationMenu.Root` in a `NavigationMenu.Content` to make a menu with more than one level.

<DemoFrame>
  <DemoNavigationMenuNested />
</DemoFrame>

::: code-group

<<< ../demos/navigation-menu/nested/css-modules/index.vue

<<< ../demos/navigation-menu/nested/css-modules/index.module.css

:::

### Nested inline submenus

A second level can stay in the panel of the first level. Then the nested root has no `NavigationMenu.Portal`. Give it a `NavigationMenu.List`, a `NavigationMenu.Viewport` and a `defaultValue`.

<DemoFrame>
  <DemoNavigationMenuNestedInline />
</DemoFrame>

::: code-group

<<< ../demos/navigation-menu/nested-inline/css-modules/index.vue

<<< ../demos/navigation-menu/nested-inline/css-modules/index.module.css

<<< ../demos/navigation-menu/nested-inline/data.ts

:::

### Custom links

`NavigationMenu.Link` renders an `<a>` element. To navigate on the client, give the link component of your router to the `as` prop. The other attributes of the part, such as `to`, go to that component.

A link for Vue Router:

<<< ../../fixtures/nuxt/app/components/NavigationMenuRouterLink.vue{3,7}

A link for Nuxt:

<<< ../../fixtures/nuxt/app/components/NavigationMenuNuxtLink.vue{3,7}

### Large menus

Large menu content can be too big for the viewport. You can choose from two solutions.

1. Make the content of the navigation menu smaller

Change the layout of the content so that it takes less space. If your content is flexible, give `max-height` to the popup. The navigation menu then becomes smaller, and the content does not overflow.

```css
.Content,
.Popup {
  max-height: var(--available-height);
}
```

2. Let the content of the navigation menu scroll

```css
.Content,
.Popup {
  max-height: var(--available-height);
}

.Content {
  overflow-y: auto;
}
```

A native scrollbar is visible while the content changes. Use [Scroll Area](/components/scroll-area) in place of a native scrollbar to hide it. The `NavigationMenu.Arrow` then also stays in the center.

## Closing animations

The popup stays in the DOM until its closing animation ends. To animate it with JavaScript, call `details.preventUnmountOnClose()` in the `valueChange` listener when the value becomes `null`. Then call the exposed `unmount()` when your animation ends. To close the menu, call the exposed `close()`. Do not set `value` to `null`.

## API reference

<ApiReference />
