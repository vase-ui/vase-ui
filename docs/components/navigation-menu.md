---
order: 1
description: An unstyled Vue navigation menu component that shows a collection of links and menus for website navigation.
---

<script setup lang="ts">
import ApiReference from '../.vitepress/components/ApiReference.vue';
import BaseUiDifferences from '../.vitepress/components/BaseUiDifferences.vue';
import DemoFrame from '../.vitepress/components/DemoFrame.vue';
import DemoSource from '../.vitepress/components/DemoSource.vue';
import DemoNavigationMenuHero from '../demos/navigation-menu/hero/css-modules/index.vue';
import DemoNavigationMenuHeroTailwind from '../demos/navigation-menu/hero/tailwind/index.vue';
import DemoNavigationMenuNested from '../demos/navigation-menu/nested/css-modules/index.vue';
import DemoNavigationMenuNestedTailwind from '../demos/navigation-menu/nested/tailwind/index.vue';
import DemoNavigationMenuNestedInline from '../demos/navigation-menu/nested-inline/css-modules/index.vue';
import DemoNavigationMenuNestedInlineTailwind from '../demos/navigation-menu/nested-inline/tailwind/index.vue';
</script>

# Navigation Menu

A collection of links and menus for website navigation.

<DemoFrame>
  <DemoNavigationMenuHero />
  <template #tailwind>
    <DemoNavigationMenuHeroTailwind />
  </template>
</DemoFrame>

<DemoSource variant="css-modules">

::: code-group

<<< ../demos/navigation-menu/hero/css-modules/index.vue

<<< ../demos/navigation-menu/hero/css-modules/index.module.css

:::

</DemoSource>

<DemoSource variant="tailwind">

::: code-group

<<< ../demos/navigation-menu/hero/tailwind/index.vue

:::

</DemoSource>

## Anatomy

Import the component and assemble its parts:

<<< ./navigation-menu/Anatomy.vue

## Examples

### Nested submenus

Put a `NavigationMenu.Root` in a `NavigationMenu.Content` to make a menu with more than one level.

<DemoFrame>
  <DemoNavigationMenuNested />
  <template #tailwind>
    <DemoNavigationMenuNestedTailwind />
  </template>
</DemoFrame>

<DemoSource variant="css-modules">

::: code-group

<<< ../demos/navigation-menu/nested/css-modules/index.vue

<<< ../demos/navigation-menu/nested/css-modules/index.module.css

:::

</DemoSource>

<DemoSource variant="tailwind">

::: code-group

<<< ../demos/navigation-menu/nested/tailwind/index.vue

:::

</DemoSource>

### Nested inline submenus

A second level can stay in the panel of the first level. Then the nested root has no `NavigationMenu.Portal`. Give it a `NavigationMenu.List`, a `NavigationMenu.Viewport` and a `defaultValue`. A root with no portal opens and changes its item, and it does not close by itself: a `NavigationMenu.Link` with `closeOnClick`, `close()` and `v-model` close it.

<DemoFrame>
  <DemoNavigationMenuNestedInline />
  <template #tailwind>
    <DemoNavigationMenuNestedInlineTailwind />
  </template>
</DemoFrame>

<DemoSource variant="css-modules">

::: code-group

<<< ../demos/navigation-menu/nested-inline/css-modules/index.vue

<<< ../demos/navigation-menu/nested-inline/css-modules/index.module.css

<<< ../demos/navigation-menu/nested-inline/data.ts

:::

</DemoSource>

<DemoSource variant="tailwind">

::: code-group

<<< ../demos/navigation-menu/nested-inline/tailwind/index.vue

<<< ../demos/navigation-menu/nested-inline/data.ts

:::

</DemoSource>

### Custom links

`NavigationMenu.Link` renders an `<a>` element. To navigate on the client, put a native `<a>` in the `element` slot of the link, in the slot of `<RouterLink custom>` or `<NuxtLink custom>`. The arrow keys of the menu then reach the link. Give it `aria-current="page"` from `isExactActive`.

A link for Vue Router:

<<< ../../fixtures/nuxt/app/components/NavigationMenuRouterLink.vue

A link for Nuxt:

<<< ../../fixtures/nuxt/app/components/NavigationMenuNuxtLink.vue

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

### Animate the content

The root of `NavigationMenu.Content` is a `<Teleport>` to the viewport, and Vue animates a `<Transition>` around such a part only from Vue 3.5.41. Use the `transition` prop of the content in place of a `<Transition>` around it. Its value is the props of a `<Transition>`, such as `:transition="{ name: 'slide' }"`. At a change of the item, the old content leaves while the new one enters. Both have `data-activation-direction`, so the classes of the transition can move them to the side of the new trigger. At a close, the content stays in the popup and leaves with it.

While the popup changes its item, `--popup-width` and `--popup-height` give it its old size and then its new size. Give the popup a CSS transition of `width` and `height` to animate the change. Give the positioner `width: var(--positioner-width)` and `height: var(--positioner-height)`. At the side `top` or `left`, the popup is then at the edge of the positioner that faces the trigger, so it grows away from the trigger.

## Closing animations

A popup in a `<Transition>` stays in the DOM until its leave ends. An open during the leave waits, and the new item shows in a new popup after the leave. To keep the popup until an animation of JavaScript ends, use the JavaScript hooks of `<Transition>`. With `:css="false"`, Vue removes the element when the `leave` hook calls `done`. See [Animation](/handbook/animation).

## API reference

<ApiReference />

## Differences from Base UI

<BaseUiDifferences />
