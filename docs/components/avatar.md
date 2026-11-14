---
order: 1
description: An unstyled Vue avatar component that is easy to customize.
---

<script setup lang="ts">
import ApiReference from '../.vitepress/components/ApiReference.vue';
import DemoFrame from '../.vitepress/components/DemoFrame.vue';
import DemoAvatarHero from '../demos/avatar/hero/css-modules/index.vue';
</script>

# Avatar

An easily stylable avatar component.

<DemoFrame>
  <DemoAvatarHero />
</DemoFrame>

::: code-group

<<< ../demos/avatar/hero/css-modules/index.vue

<<< ../demos/avatar/hero/css-modules/index.module.css

:::

## Anatomy

Import the component and assemble its parts:

<<< ./avatar/Anatomy.vue

## Optimized and lazy-loaded images

By default, `<Avatar.Image>` loads `src` ahead and renders the image only after it has loaded. This does not work with `loading="lazy"`. It also does not work with an image component that serves a different URL than `src`.

Set the `keepMounted` prop to render the image element at once and let it load in place. The browser then requests only the image that it displays:

<<< ./avatar/LazyImage.vue

An image component that renders its own `<img>` also needs `keepMounted`. Put the component in the `#render` slot. Bind `props` on it.

### Stacking

With `keepMounted`, the image and the fallback are both present until the image has loaded. Until then, the image is hidden from assistive technology, so only the fallback gives the accessible name.

Put the two in the same box. Put `<Avatar.Image>` after `<Avatar.Fallback>`. Both are positioned, so the later one in the DOM paints on top. The fallback shows until the image covers it.

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

Do not use `display: none` here. An element with no box never intersects the viewport, so `loading="lazy"` would never request the image. `visibility` and `opacity` do not stop lazy loading.

### Server rendering

With `keepMounted`, the image is in the server HTML and starts to load before hydration. The fallback is also in the server HTML, and it stays visible until hydration reads the loading status. A cached image shows at once, with no enter animation.

## API reference

<ApiReference />

## Additional types

### ImageLoadingStatus

<ApiReference name="ImageLoadingStatus" />
