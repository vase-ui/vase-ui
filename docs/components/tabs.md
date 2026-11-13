---
order: 1
description: An unstyled Vue tabs component for toggling between related panels on the same page.
---

<script setup lang="ts">
import ApiReference from '../.vitepress/components/ApiReference.vue';
import DemoFrame from '../.vitepress/components/DemoFrame.vue';
import DemoTabsAnimatedPanels from '../demos/tabs/animated-panels/css-modules/index.vue';
import DemoTabsHero from '../demos/tabs/hero/css-modules/index.vue';
</script>

# Tabs

A component for toggling between related panels on the same page.

<DemoFrame>
  <DemoTabsHero />
</DemoFrame>

::: code-group

<<< ../demos/tabs/hero/css-modules/index.vue

<<< ../demos/tabs/hero/css-modules/index.module.css

:::

## Anatomy

Import the component and assemble its parts:

<<< ./tabs/Anatomy.vue

## Examples

### Animated panels

Use the `data-starting-style` and `data-ending-style` attributes to animate a panel as it enters and leaves. The `data-activation-direction` attribute gives the direction of the new tab, relative to the old tab. A panel can then slide in from the correct side.

<DemoFrame>
  <DemoTabsAnimatedPanels />
</DemoFrame>

::: code-group

<<< ../demos/tabs/animated-panels/css-modules/index.vue

<<< ../demos/tabs/animated-panels/css-modules/index.module.css

:::

### Links

A tab renders a `<button>` by default. To render an anchor element, set `nativeButton` to `false`. Render the anchor in the `#render` slot. Bind `props` on it.

<<< ./tabs/Links.vue{8-10}

## API reference

<ApiReference />
