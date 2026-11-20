---
order: 1
description: An unstyled Vue tabs component that toggles between related panels on the same page.
---

<script setup lang="ts">
import ApiReference from '../.vitepress/components/ApiReference.vue';
import BaseUiDifferences from '../.vitepress/components/BaseUiDifferences.vue';
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

## Examples

### Animated panels

Put each panel in a `<Transition>` to animate it when its tab becomes active. The `data-activation-direction` attribute gives the side of the new active tab from the old one. The panel that enters can then slide in from the correct side, and the panel that leaves can slide out to the other side.

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

Render an `<a>` in the `element` slot of `<Tabs.Tab>`, or give `as` a link component, such as `RouterLink`. The tab reads its element, so a link activates with a press, Enter and Space.

<<< ./tabs/Links.vue{9-11}

### Render on the server

The server HTML has the active tab and its open panel. In the server render, a part knows only the parts before it. A panel before the list is thus open in the server HTML only when the root has a `modelValue` or a `defaultValue`.

`Tabs.Indicator` has no measure in the server HTML, so it is `hidden` until the mount. When the page shows the server HTML for some time, set `renderBeforeHydration`. An inline script in the indicator then places it before the app starts.

## API reference

<ApiReference />

## Differences from Base UI

<BaseUiDifferences />
