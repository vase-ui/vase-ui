---
order: 1
description: An unstyled Vue navigation menu component that shows a collection of links and menus for website navigation.
---

<script setup lang="ts">
import ApiReference from '../.vitepress/components/ApiReference.vue';
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

## Animation

The popup and the backdrop are in the DOM only while the menu is open. Put each of them in a `<Transition appear>`, and animate them with the classes of `<Transition>`. A reopen while the popup leaves shows the new item in a new popup after the leave.

A content is in a `<Teleport>` to the viewport, and Vue animates a `<Transition>` around such a part only from Vue 3.5.41. So give the props of a `<Transition>` to the `transition` prop of `NavigationMenu.Content`, such as `:transition="{ name: 'slide' }"`. At a change of the item, the old content leaves while the new one enters. Both have `data-activation-direction`, so the classes of the transition can move them to the side of the new trigger. At a close, the content stays in the popup and goes with it.

While the popup changes its item, `--popup-width` and `--popup-height` give it its old size and then its new size. Give the popup a CSS transition of `width` and `height` to animate the change. Give the positioner `width: var(--positioner-width)` and `height: var(--positioner-height)`: at the side `top` or `left`, the popup is at the edge of the positioner that faces the trigger, so it grows away from the trigger.

To keep the popup in the DOM until an animation of JavaScript ends, use the JavaScript hooks of `<Transition>`. With `:css="false"`, Vue removes the element when the `leave` hook calls `done`. Use `@after-enter` and `@after-leave` for code that runs after an animation.

## Keyboard

| Key                                | Action                                                                                                                                                 |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| <kbd>Enter</kbd>, <kbd>Space</kbd> | On a trigger: opens or closes its item.                                                                                                                |
| <kbd>ArrowDown</kbd>               | On a trigger of a horizontal root: opens its item. In a vertical root, <kbd>ArrowRight</kbd> opens it, and <kbd>ArrowLeft</kbd> in right-to-left text. |
| Arrow keys of the orientation      | In the list: move the focus to the next or the previous trigger or link, with no loop.                                                                 |
| Arrow keys                         | In a content: move the focus between its links and triggers, with a loop.                                                                              |
| <kbd>Tab</kbd>                     | On the trigger of the open item: goes into its content. From the end of the content, goes to the next item.                                            |
| <kbd>Escape</kbd>                  | In a menu with a portal: closes the menu, and the focus in the popup goes to the trigger.                                                              |

## Styling

Select the states of the parts with these selectors:

| Selector                      | On                                   | State                                                                                         |
| ----------------------------- | ------------------------------------ | --------------------------------------------------------------------------------------------- |
| `[aria-expanded="true"]`      | trigger                              | The item of the trigger is open.                                                              |
| `[aria-disabled="true"]`      | trigger                              | The trigger is disabled. It keeps the focus. In a disabled fieldset it has `:disabled`.       |
| `[aria-current="page"]`       | link                                 | The link of the current page, with `aria-current` that you give.                              |
| `[data-popup-open]`           | icon                                 | The item of the icon is open.                                                                 |
| `[data-activation-direction]` | content                              | The side of the new trigger from the old one: `left`, `right`, `up` or `down`.                |
| `[data-side]`, `[data-align]` | positioner, popup, arrow             | The side of the trigger and the alignment of the popup.                                       |
| `[data-anchor-hidden]`        | positioner, popup                    | The trigger is out of view.                                                                   |
| `[data-uncentered]`           | arrow                                | The arrow cannot point at the center of the trigger.                                          |
| `[data-instant]`              | positioner                           | An animation should not run: the popup takes its first place, or the window changes its size. |
| `[hidden]`                    | content, positioner, popup, backdrop | A closed content with `keepMounted`, or the closed parts of a portal with `keepMounted`.      |

These CSS variables give the sizes and the place:

| Variable                                    | On         | Value                                                                 |
| ------------------------------------------- | ---------- | --------------------------------------------------------------------- |
| `--anchor-width`, `--anchor-height`         | positioner | The size of the trigger.                                              |
| `--available-width`, `--available-height`   | positioner | The room from the trigger to the edge of the collision boundary.      |
| `--transform-origin`                        | positioner | The point that the popup grows from.                                  |
| `--positioner-width`, `--positioner-height` | positioner | The size of the popup, and the size of the new content at a change.   |
| `--popup-width`, `--popup-height`           | popup      | The old size, then the new size, while the popup changes its content. |

### Scoped styles

The root of `NavigationMenu.Content` is a `<Teleport>`, so a scoped rule of the parent does not reach its default element. Use a CSS module class or `:deep()`, or render your element in the `element` slot of the content.

## Server render

`NavigationMenu.Portal` renders its content after its mount, so the server HTML has the list, the triggers and the links of the list. With `keepMounted`, a `NavigationMenu.Content` is in the server HTML, hidden in its item, so its links are in the page also before the app runs. After the hydration, Vue mounts the content again in a `<Teleport>`, so a component in it mounts two times.

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

## Portal target

Set `to` on `NavigationMenu.Portal` to select a target. For example, `to="#overlays"` selects the element with that ID. With no `to`, the portal goes to the target of the portal above, else to `<body>`. A portal in a content goes where the portal of its root goes. `disabled` renders the content in place, and `defer` waits for the other content of the update. `NavigationMenu.Root` exposes `close()` through a template ref.

## API reference

<ApiReference />
