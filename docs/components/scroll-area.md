---
order: 1
description: An unstyled Vue scroll area component that adds custom scrollbars to a native scroll container.
---

<script setup lang="ts">
import ApiReference from '../.vitepress/components/ApiReference.vue';
import BaseUiDifferences from '../.vitepress/components/BaseUiDifferences.vue';
import DemoFrame from '../.vitepress/components/DemoFrame.vue';
import DemoSource from '../.vitepress/components/DemoSource.vue';
import DemoScrollAreaBoth from '../demos/scroll-area/both/css-modules/index.vue';
import DemoScrollAreaBothTailwind from '../demos/scroll-area/both/tailwind/index.vue';
import DemoScrollAreaHero from '../demos/scroll-area/hero/css-modules/index.vue';
import DemoScrollAreaHeroTailwind from '../demos/scroll-area/hero/tailwind/index.vue';
import DemoScrollAreaScrollFade from '../demos/scroll-area/scroll-fade/css-modules/index.vue';
import DemoScrollAreaScrollFadeTailwind from '../demos/scroll-area/scroll-fade/tailwind/index.vue';
</script>

# Scroll Area

A native scroll container with custom scrollbars.

<DemoFrame>
  <DemoScrollAreaHero />
  <template #tailwind>
    <DemoScrollAreaHeroTailwind />
  </template>
</DemoFrame>

<DemoSource variant="css-modules">

::: code-group

<<< ../demos/scroll-area/hero/css-modules/index.vue

<<< ../demos/scroll-area/hero/css-modules/index.module.css

:::

</DemoSource>

<DemoSource variant="tailwind">

::: code-group

<<< ../demos/scroll-area/hero/tailwind/index.vue

:::

</DemoSource>

## Anatomy

Import the component and assemble its parts:

<<< ./scroll-area/Anatomy.vue

## Examples

### Both scrollbars

Use `<ScrollArea.Corner>` so that the two scrollbars do not cross.

<DemoFrame>
  <DemoScrollAreaBoth />
  <template #tailwind>
    <DemoScrollAreaBothTailwind />
  </template>
</DemoFrame>

<DemoSource variant="css-modules">

::: code-group

<<< ../demos/scroll-area/both/css-modules/index.vue

<<< ../demos/scroll-area/both/css-modules/index.module.css

:::

</DemoSource>

<DemoSource variant="tailwind">

::: code-group

<<< ../demos/scroll-area/both/tailwind/index.vue

:::

</DemoSource>

### Gradient scroll fade

Use the overflow CSS variables of the viewport in a CSS mask. The fade then grows as the user scrolls away from an edge.

The server HTML has no value for the variables. Give the `var()` of the end edge a fallback, as the demo does, so that the fade shows before the hydration.

The viewport writes the variables at each scroll, and each element in it inherits them. With thousands of elements in the viewport, the browser can then need some milliseconds in a frame. Register the variables with `inherits: false`, and set each variable that a child uses to `inherit`:

```css
@property --scroll-area-overflow-y-start {
  syntax: '<length>';
  inherits: false;
  initial-value: 0px;
}

.Child {
  --scroll-area-overflow-y-start: inherit;
}
```

Before the measurement, a registered variable has its `initial-value`, not the fallback of `var()`.

<DemoFrame>
  <DemoScrollAreaScrollFade />
  <template #tailwind>
    <DemoScrollAreaScrollFadeTailwind />
  </template>
</DemoFrame>

<DemoSource variant="css-modules">

::: code-group

<<< ../demos/scroll-area/scroll-fade/css-modules/index.vue

<<< ../demos/scroll-area/scroll-fade/css-modules/index.module.css

:::

</DemoSource>

<DemoSource variant="tailwind">

::: code-group

<<< ../demos/scroll-area/scroll-fade/tailwind/index.vue

:::

</DemoSource>

## API reference

<ApiReference />

## Differences from Base UI

<BaseUiDifferences />
