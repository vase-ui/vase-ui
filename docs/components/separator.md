---
order: 1
description: An unstyled Vue separator component that is accessible to screen readers.
---

<script setup lang="ts">
import ApiReference from '../.vitepress/components/ApiReference.vue';
import DemoFrame from '../.vitepress/components/DemoFrame.vue';
import DemoSource from '../.vitepress/components/DemoSource.vue';
import DemoSeparatorHero from '../demos/separator/hero/css-modules/index.vue';
import DemoSeparatorHeroTailwind from '../demos/separator/hero/tailwind/index.vue';
</script>

# Separator

A separator element that is accessible to screen readers.

<DemoFrame>
  <DemoSeparatorHero />
  <template #tailwind>
    <DemoSeparatorHeroTailwind />
  </template>
</DemoFrame>

<DemoSource variant="css-modules">

::: code-group

<<< ../demos/separator/hero/css-modules/index.vue

<<< ../demos/separator/hero/css-modules/index.module.css

:::

</DemoSource>

<DemoSource variant="tailwind">

::: code-group

<<< ../demos/separator/hero/tailwind/index.vue

:::

</DemoSource>

## Anatomy

Import the component and use it as a single part:

<<< ./separator/Anatomy.vue

`Separator` renders one `<div role="separator">`. Each attribute and listener that you give goes to the `<div>`.

## Orientation

`aria-orientation` has the value of the `orientation` prop: `horizontal` by default, or `vertical`. Select it in CSS:

```css
.Separator[aria-orientation='vertical'] {
  width: 1px;
}
```

## Content

The default slot holds content, such as a glyph or an icon between two groups. Assistive technology does not read the content of a separator. For a line that is only decoration, give `aria-hidden="true"` to the separator.

## Another element

`as` renders another tag or a component in place of the `<div>`. A paragraph cannot hold a `<div>`, so give `as="span"`:

<<< ./separator/AnotherElement.vue

For full control, render your own element in the `element` slot. Bind `props` and `elementRef` on it.

A native `<hr>` has the role `separator` too. For a horizontal line with no content, use `<hr>` with no part.

## API reference

<ApiReference />
