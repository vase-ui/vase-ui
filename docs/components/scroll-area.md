---
order: 1
description: An unstyled Vue scroll area that gives a native scroll container with custom scrollbars.
---

<script setup lang="ts">
import ApiReference from '../.vitepress/components/ApiReference.vue';
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

Use the overflow CSS variables of the viewport in a CSS mask. The fade then increases gradually as the user scrolls away from the edges.

```css
.Viewport {
  mask-image: linear-gradient(
    to bottom,
    transparent 0,
    black min(40px, var(--scroll-area-overflow-y-start)),
    black calc(100% - min(40px, var(--scroll-area-overflow-y-end, 40px))),
    transparent 100%
  );
  mask-repeat: no-repeat;
}
```

The variables have values only after the client measures the viewport. For a server render, give the end-side `var()` a fallback. The mask is then visible before the variables have values.

```css
var(--scroll-area-overflow-y-end, 40px);
```

Use the variables directly on `<ScrollArea.Viewport>`. For a fade on a child, set each variable it uses to `inherit`.

```css
.Child {
  --scroll-area-overflow-y-start: inherit;
  --scroll-area-overflow-y-end: inherit;
}
```

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
