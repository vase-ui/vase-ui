---
order: 1
description: An unstyled Vue tabs component that toggles between related panels on the same page.
---

<script setup lang="ts">
import ApiReference from '../.vitepress/components/ApiReference.vue';
import DemoFrame from '../.vitepress/components/DemoFrame.vue';
import DemoSource from '../.vitepress/components/DemoSource.vue';
import DemoTabsAnimatedPanels from '../demos/tabs/animated-panels/css-modules/index.vue';
import DemoTabsAnimatedPanelsTailwind from '../demos/tabs/animated-panels/tailwind/index.vue';
import DemoTabsHero from '../demos/tabs/hero/css-modules/index.vue';
import DemoTabsHeroTailwind from '../demos/tabs/hero/tailwind/index.vue';
</script>

# Tabs

A component that toggles between related panels on the same page.

<DemoFrame>
  <DemoTabsHero />
  <template #tailwind>
    <DemoTabsHeroTailwind />
  </template>
</DemoFrame>

<DemoSource variant="css-modules">

::: code-group

<<< ../demos/tabs/hero/css-modules/index.vue

<<< ../demos/tabs/hero/css-modules/index.module.css

:::

</DemoSource>

<DemoSource variant="tailwind">

::: code-group

<<< ../demos/tabs/hero/tailwind/index.vue

:::

</DemoSource>

## Anatomy

Import the component and assemble its parts:

<<< ./tabs/Anatomy.vue

`Tabs.List` renders a `<div role="tablist">`, each `Tabs.Tab` a `<button role="tab">`, and each `Tabs.Panel` a `<div role="tabpanel">`. A part outside `Tabs.Root` throws an error, and so does a tab or an indicator outside `Tabs.List`.

Bind the value with `v-model`, or give `defaultValue` to an uncontrolled root. With no value, the first tab that is not disabled is active, as the first option of a native `<select>`. With `null`, no tab is active. A press, Enter and Space activate a tab. With `activateOnFocus`, the arrow keys, Home and End also activate the tab that they focus. A change emits `valueChange` and then `update:modelValue`. To keep the value, call `details.cancel()` in `valueChange`.

An uncontrolled root also changes its value itself. After the mount, a root with no value takes its first tab that is not disabled, with the reason `initial`. When the active tab becomes disabled (`disabled`), or no tab has the value (`missing`), the root takes the first tab that is not disabled, or `null`. A `defaultValue` that names a disabled tab stays until that tab is enabled one time. A controlled root shows only the value of its parent.

A disabled tab has `aria-disabled="true"` and keeps the focus, so the arrow keys reach it. It gets no `click`, so no `click` listener on it or on an ancestor runs.

The list is one tab stop: the focused tab while the focus is in the list, or else the active tab, also a disabled one. With no active tab, the first tab has the tab stop. The arrow keys follow `orientation` and the text direction of the list (`dir`), and they loop unless `loopFocus` is `false`. The list keeps each arrow key, Home and End that it handles: an ancestor with keys of its own, such as a toolbar, does not get them.

At the mount, a list that scrolls shows its active tab. It reads the `scroll-padding` of the list and the `scroll-margin` of the tab, and it does not scroll the page.

### Server render

The server HTML has the active tab and its open panel. A tab knows only the tabs before it, so a panel before the list shows when its value comes from `modelValue` or `defaultValue`. Each part names in its ARIA attributes the parts before it. After the hydration, each part names each other part.

`Tabs.Indicator` has no measure in the server HTML, so it is `hidden`. With `renderBeforeHydration`, an inline script in the indicator places it before the app starts.

### Kept panels

A closed panel is not in the DOM. With `keepMounted`, it stays with `hidden` and `inert`: its state stays, and find-in-page and the server HTML have it. CSS that shows a `[hidden]` panel can animate it, and the panel still takes no focus and no press.

## Styling

Select the states of the parts with these selectors:

| Selector                              | State                                    |
| ------------------------------------- | ---------------------------------------- |
| `[aria-selected="true"]`              | The tab is active.                       |
| `[aria-disabled="true"]`              | The tab is disabled.                     |
| `[aria-orientation="vertical"]`       | The list is vertical.                    |
| `:not([aria-orientation="vertical"])` | The list is horizontal.                  |
| `[hidden]`                            | The panel is closed, with `keepMounted`. |
| `:focus-visible`                      | The tab has the focus from the keyboard. |

The parts have these attributes:

| Attribute                   | Parts                             | Values                                                                                   |
| --------------------------- | --------------------------------- | ---------------------------------------------------------------------------------------- |
| `data-orientation`          | Root, Tab, Panel, Indicator       | `horizontal` or `vertical`                                                               |
| `data-activation-direction` | Root, List, Tab, Panel, Indicator | The side of the new active tab from the old one: `left`, `right`, `up`, `down` or `none` |

`Tabs.Indicator` has these CSS variables. Each one is a length in pixels in the layout of the list:

| Variable              | Value                                                     |
| --------------------- | --------------------------------------------------------- |
| `--active-tab-left`   | The distance from the left edge of the list to the tab.   |
| `--active-tab-right`  | The distance from the right edge of the list to the tab.  |
| `--active-tab-top`    | The distance from the top edge of the list to the tab.    |
| `--active-tab-bottom` | The distance from the bottom edge of the list to the tab. |
| `--active-tab-width`  | The width of the active tab.                              |
| `--active-tab-height` | The height of the active tab.                             |

## Examples

### Animated panels

Put each panel in a `<Transition>`. Its enter and leave classes animate the panel. The `data-activation-direction` attribute gives the side of the new tab from the old tab. A panel can then slide in from the correct side, and the panel that leaves slides out to the other side.

<DemoFrame>
  <DemoTabsAnimatedPanels />
  <template #tailwind>
    <DemoTabsAnimatedPanelsTailwind />
  </template>
</DemoFrame>

<DemoSource variant="css-modules">

::: code-group

<<< ../demos/tabs/animated-panels/css-modules/index.vue

<<< ../demos/tabs/animated-panels/css-modules/index.module.css

:::

</DemoSource>

<DemoSource variant="tailwind">

::: code-group

<<< ../demos/tabs/animated-panels/tailwind/index.vue

:::

</DemoSource>

### Links

A tab renders a `<button>` by default. To render a link, render an `<a>` in the `element` slot, and bind `props` and `elementRef` on it. The tab reads its element: a link activates with a press, Enter and Space.

<<< ./tabs/Links.vue{9-11}

## API reference

<ApiReference />
