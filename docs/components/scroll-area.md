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

Each part renders one `<div>`. `ScrollArea.Viewport` is a native scroll container on the two axes, so the wheel, a touch, the keyboard and scroll snap work as in each browser. The root hides its native scrollbars. `ScrollArea.Scrollbar` and `ScrollArea.Corner` lie over the viewport and add no space.

The viewport is a tab stop while it can scroll. Give it `role="region"` and a name, such as `aria-label`, when it is a landmark of the page. A scrollbar and a corner have `aria-hidden="true"` and take no focus.

A scrollbar renders while its axis has overflow. With `keepMounted`, it renders also with no overflow, in the server HTML too. Hide such a track with `:not([data-has-overflow-y])`. The corner renders while the two axes have overflow.

Each part has the `element` slot, which gives `props`, `elementRef` and `state`. The corner gives no `state`. Bind `props` and `elementRef` to the element that you render. A root that renders its element in the slot has no style element in the server HTML, so the native scrollbar shows until the mount.

## Styling

Select the states with these attributes:

| Attribute                                          | On                                        | State                                                            |
| -------------------------------------------------- | ----------------------------------------- | ---------------------------------------------------------------- |
| `[data-scrolling]`                                 | root, viewport, content, scrollbar, thumb | The user scrolls. A scrollbar and a thumb follow their own axis. |
| `[data-has-overflow-x]`, `[data-has-overflow-y]`   | root, viewport, content, scrollbar        | The axis has overflow.                                           |
| `[data-overflow-x-start]`, `[data-overflow-x-end]` | root, viewport, content, scrollbar        | The content overflows the inline start or the inline end edge.   |
| `[data-overflow-y-start]`, `[data-overflow-y-end]` | root, viewport, content, scrollbar        | The content overflows the top or the bottom edge.                |
| `[data-orientation]`                               | scrollbar, thumb                          | `vertical` or `horizontal`.                                      |

`scrolling` is `true` only for a scroll of the user: a wheel, a touch, the keyboard, or a drag of a thumb or a track. A scroll of a script, such as `scrollTo()`, does not set it. The state ends 500 ms after the last scroll.

To show the scrollbars on hover, select the hover of the root. The browser keeps `:hover` also while a drag of the thumb leaves the root:

```css
.Scrollbar {
  opacity: 0;
}

.Scrollbar[data-scrolling] {
  opacity: 1;
}

@media (hover: hover) {
  .ScrollArea:hover .Scrollbar {
    opacity: 1;
  }
}
```

With Tailwind CSS, put `group` on the root and `group-hover:opacity-100` on the scrollbar.

These CSS variables give the sizes:

| Variable                                                         | On        | Value                                                        |
| ---------------------------------------------------------------- | --------- | ------------------------------------------------------------ |
| `--scroll-area-corner-width`, `--scroll-area-corner-height`      | root      | The size of the corner. `0px` with no corner.                |
| `--scroll-area-thumb-height`, `--scroll-area-thumb-width`        | scrollbar | The length of the thumb.                                     |
| `--scroll-area-overflow-x-start`, `--scroll-area-overflow-x-end` | viewport  | The distance to the inline start and to the inline end edge. |
| `--scroll-area-overflow-y-start`, `--scroll-area-overflow-y-end` | viewport  | The distance to the top and to the bottom edge.              |

The thumb moves with the CSS property `translate`, so `transform` stays free for your styles. The length of a thumb counts the padding of its track and the margins of the thumb. Give a horizontal thumb equal inline margins: in right-to-left, WebKit reports the used value of the end margin, so the part counts the start margin two times.

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

Each element in the viewport inherits the variables, so a fade on a child works with no more CSS. The viewport writes them at each scroll, and the browser then computes the style of each element in it again. With thousands of elements, this can take some milliseconds in a frame. To keep the variables on the viewport, register them with `inherits: false`, and set each variable that a child uses to `inherit`:

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
