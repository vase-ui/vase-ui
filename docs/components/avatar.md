---
order: 1
description: An unstyled Vue avatar component that is easy to customize.
---

<script setup lang="ts">
import ApiReference from '../.vitepress/components/ApiReference.vue';
import BaseUiDifferences from '../.vitepress/components/BaseUiDifferences.vue';
import DemoFrame from '../.vitepress/components/DemoFrame.vue';
import DemoSource from '../.vitepress/components/DemoSource.vue';
import DemoAvatarHero from '../demos/avatar/hero/css-modules/index.vue';
import DemoAvatarHeroTailwind from '../demos/avatar/hero/tailwind/index.vue';
</script>

# Avatar

An avatar component that is easy to style.

<DemoFrame>
  <DemoAvatarHero />
  <template #tailwind>
    <DemoAvatarHeroTailwind />
  </template>
</DemoFrame>

<DemoSource variant="css-modules">

::: code-group

<<< ../demos/avatar/hero/css-modules/index.vue

<<< ../demos/avatar/hero/css-modules/index.module.css

:::

</DemoSource>

<DemoSource variant="tailwind">

::: code-group

<<< ../demos/avatar/hero/tailwind/index.vue

:::

</DemoSource>

## Anatomy

Import the component and assemble its parts:

<<< ./avatar/Anatomy.vue

## Optimized and lazy-loaded images

By default, `<Avatar.Image>` loads `src` with an image outside the document, and it renders the `<img>` only after the picture loads. An image component that serves another URL than `src` thus does not work, and `loading="lazy"` has no effect.

Add the `keepMounted` prop to render the image element at once and let it load in place. The browser then requests only the image that it shows. Put an image component or your own `<img>` in the `element` slot, with `v-bind="props"` and `:ref="elementRef"`:

<<< ./avatar/ImageComponent.vue

### Stacking

With `keepMounted`, the image and the fallback are both present until the image loads. Until then, the image is hidden from assistive technology, so the fallback gives the accessible name.

Put the two in the same box. Put `<Avatar.Image>` after `<Avatar.Fallback>`. Both are positioned, so the later one in the DOM paints on top. The fallback then shows until the image covers it.

While an image loads, it paints nothing, so the fallback shows through it. An image that failed to load paints a broken-image icon on top of the fallback. Hide the image in these two states with the `data-loading` and `data-error` attributes:

```css
.Root {
  position: relative;
}

.Image,
.Fallback {
  position: absolute;
  inset: 0;
}

.Image[data-loading],
.Image[data-error] {
  visibility: hidden;
}
```

Do not use `display: none` or the `hidden` attribute here. In Chromium, Firefox and WebKit, a lazy image with no box requests no picture. `visibility` and `opacity` do not stop lazy loading.

### Server rendering

By default, the server HTML has no image. With `keepMounted`, the image is in the server HTML and starts to load before the hydration. The fallback is also in the server HTML, and it stays visible until the hydration reads the loading status.

## Examples

### Animate the image

Put `<Avatar.Image>` in a `<Transition>` to animate its enter and its leave. Vue keeps an image that leaves in the DOM beside the fallback until its leave ends. Take that image out of the flow with CSS:

<<< ./avatar/Animated.vue

A `<Transition>` around `<Avatar.Fallback>` needs the same CSS. `<Transition>` does not animate an image in the `element` slot, or an image that `keepMounted` keeps in the DOM. For such an image, use `keepMounted` and a CSS transition on `[data-loading]`.

## API reference

<ApiReference />

### ImageLoadingStatus

The loading status of the image.

<ApiReference name="ImageLoadingStatus" :heading-level="4" />

## Differences from Base UI

<BaseUiDifferences />
