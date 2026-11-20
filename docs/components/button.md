---
order: 1
description: An unstyled Vue button component that can stay focusable while it is disabled.
---

<script setup lang="ts">
import ApiReference from '../.vitepress/components/ApiReference.vue';
import BaseUiDifferences from '../.vitepress/components/BaseUiDifferences.vue';
import DemoFrame from '../.vitepress/components/DemoFrame.vue';
import DemoSource from '../.vitepress/components/DemoSource.vue';
import DemoButtonHero from '../demos/button/hero/css-modules/index.vue';
import DemoButtonHeroTailwind from '../demos/button/hero/tailwind/index.vue';
import DemoButtonLoading from '../demos/button/loading/css-modules/index.vue';
import DemoButtonLoadingTailwind from '../demos/button/loading/tailwind/index.vue';
</script>

# Button

A button that can render another tag and stay focusable while it is disabled.

<DemoFrame>
  <DemoButtonHero />
  <template #tailwind>
    <DemoButtonHeroTailwind />
  </template>
</DemoFrame>

<DemoSource variant="css-modules">

::: code-group

<<< ../demos/button/hero/css-modules/index.vue

<<< ../demos/button/hero/css-modules/index.module.css

:::

</DemoSource>

<DemoSource variant="tailwind">

::: code-group

<<< ../demos/button/hero/tailwind/index.vue

:::

</DemoSource>

## Usage guidelines

- **Submit buttons**: Button renders `type="button"`, so it does not submit its form as a native `<button>` does. Set `type="submit"` on Button for a submit button.
- **Links**: Button has the semantics of a button: the role, the keys and the disabled state. Do not use it for a link. See [Rendering links as buttons](#rendering-links-as-buttons).

## Anatomy

Import the component:

<<< ./button/Anatomy.vue

## Examples

### Rendering as another tag

Give `as` another tag, such as `div`. Button then gives the element `role="button"`, a tab stop and the keys Enter and Space, so it stays accessible from the keyboard.

<<< ./button/CustomTagButton.vue{6}

The server HTML has these attributes for a tag in `as`. A component in `as` or in the `element` slot gets them at the mount. Write `role` and `tabindex` on such an element when the server HTML must have them.

### Rendering links as buttons

A link (`<a>`) has its own semantics. Do not render a link in `as` or in the `element` slot of Button. To make a link look like a button, style the `<a>` element with CSS.

### Loading states

Set `focusableWhenDisabled` on a button that becomes disabled while it loads. The button then keeps the focus.

Some combinations of a browser and a screen reader do not announce a change of the text in a focused button. Use [`aria-labelledby`](https://www.w3.org/TR/accname-1.2/#computation-steps) to make the changing text the accessible name of the button.

<DemoFrame>
  <DemoButtonLoading />
  <template #tailwind>
    <DemoButtonLoadingTailwind />
  </template>
</DemoFrame>

<DemoSource variant="css-modules">

::: code-group

<<< ../demos/button/loading/css-modules/index.vue

<<< ../demos/button/loading/css-modules/index.module.css

:::

</DemoSource>

<DemoSource variant="tailwind">

::: code-group

<<< ../demos/button/loading/tailwind/index.vue

:::

</DemoSource>

## API reference

<ApiReference />

## Differences from Base UI

<BaseUiDifferences />
