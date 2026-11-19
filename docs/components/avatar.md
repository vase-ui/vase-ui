---
order: 1
description: An unstyled Vue avatar component that is easy to customize.
---

<script setup lang="ts">
import ApiReference from '../.vitepress/components/ApiReference.vue';
import DemoFrame from '../.vitepress/components/DemoFrame.vue';
import DemoSource from '../.vitepress/components/DemoSource.vue';
import DemoAvatarHero from '../demos/avatar/hero/css-modules/index.vue';
import DemoAvatarHeroTailwind from '../demos/avatar/hero/tailwind/index.vue';
</script>

# Avatar

An easily stylable avatar component.

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

## Loading the image

By default, `<Avatar.Image>` loads the picture with an image outside the document. It renders the `<img>` only after the picture has loaded, so one of the image and the fallback is in the DOM, and they need no CSS to stack them. A picture that the browser already has shows at once, from `src` and from `srcset`.

The image has `alt=""` by default, also for an `alt` that is `undefined`. Give an `alt` when no text beside the avatar names the person.

## Optimized and lazy-loaded images

In the default mode, `loading="lazy"` has no effect. An image component that serves another URL than `src` does not work in the default mode either.

Set the `keepMounted` prop to render the image element at once and let it load in place. The browser then requests only the image that it displays:

<<< ./avatar/LazyImage.vue

An image component that renders its own `<img>` also needs `keepMounted`. Put the component or the `<img>` in the `#element` slot, with `v-bind="props"` and `:ref="elementRef"`:

<<< ./avatar/ImageComponent.vue

The part reads the `<img>` from the `element` that a component exposes. For a component that exposes no `element`, give its root element: `:ref="(image) => elementRef(image?.$el)"`. With no element, the part reads the status from the `load` and `error` events only.

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

Do not use `display: none` or the `hidden` attribute here. In Chromium, Firefox and WebKit, a lazy image with no box requests no picture. `visibility` and `opacity` do not stop lazy loading.

### Attributes

With `keepMounted`, `<Avatar.Image>` writes these attributes on the `<img>`:

| Attribute            | State                                                           |
| -------------------- | --------------------------------------------------------------- |
| `data-loading`       | The picture loads.                                              |
| `data-error`         | The picture failed to load.                                     |
| `aria-hidden="true"` | The picture is not loaded. An `aria-hidden` that you give wins. |

### Server rendering

In the default mode, the server HTML has no image. With `keepMounted`, the image is in the server HTML and starts to load before hydration. The fallback is also in the server HTML, and it stays visible until hydration reads the loading status.

## Animation

Put `<Avatar.Image>` in a Vue `<Transition>` to animate its enter and its leave. Vue keeps a leaving image in the DOM beside the fallback until its leave ends, so take the leaving element out of the flow with CSS:

<<< ./avatar/Animated.vue

A `<Transition>` around `<Avatar.Fallback>` needs the same CSS. With `keepMounted`, the image stays in the DOM, so animate it with a CSS transition on `[data-loading]`.

## API reference

<ApiReference />

## Additional types

### ImageLoadingStatus

<ApiReference name="ImageLoadingStatus" />
