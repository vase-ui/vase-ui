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

When the focus leaves the list, the tab stop moves to the active tab, unless that tab is disabled. This is also true with manual activation. When the value changes to `null` or to a disabled tab while the focus is outside the list, the tab stop moves to the first tab that is not disabled. With a controlled `modelValue`, a selected tab that becomes disabled keeps the tab stop.

## Examples

### Animated panels

Use the `data-starting-style` and `data-ending-style` attributes to animate a panel as it enters and leaves. The `data-activation-direction` attribute gives the direction of the new tab, relative to the old tab. A panel can then slide in from the correct side.

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

A tab renders a `<button>` by default. To render an anchor element, set `nativeButton` to `false`. Render the anchor in the `#render` slot. Bind `props` on it.

<<< ./tabs/Links.vue{8-10}

## API reference

<ApiReference />
