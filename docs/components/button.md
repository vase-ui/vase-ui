---
order: 1
description: An unstyled Vue button component that can stay focusable while it is disabled.
---

<script setup lang="ts">
import ApiReference from '../.vitepress/components/ApiReference.vue';
import DemoFrame from '../.vitepress/components/DemoFrame.vue';
import DemoSource from '../.vitepress/components/DemoSource.vue';
import DemoButtonHero from '../demos/button/hero/css-modules/index.vue';
import DemoButtonHeroTailwind from '../demos/button/hero/tailwind/index.vue';
import DemoButtonLoading from '../demos/button/loading/css-modules/index.vue';
import DemoButtonLoadingTailwind from '../demos/button/loading/tailwind/index.vue';
</script>

# Button

A button component that can stay focusable while it is disabled.

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

- **Submit buttons**: Button renders a native `<button>` with no `type`. In a form, it is a submit button, as the native element is. Set `type="button"` on a button that must not submit its form.
- **Links**: Button has button semantics (`role="button"`, keyboard interaction, disabled state). Do not use it for a link. See [Rendering links as buttons](#rendering-links-as-buttons).

## Anatomy

Import the component:

<<< ./button/Anatomy.vue

## Examples

### Rendering as another tag

Render another element, such as a `<div>`, in the `element` slot. Bind `props` and `elementRef` to it. The part then gives the element `role="button"`, a tab stop, and the keys Enter and Space, so the button stays keyboard accessible.

<<< ./button/CustomTagButton.vue{7-9}

The part reads its element after the mount, so the server HTML of the element has no `role` and no `tabindex`. Write the two attributes on the element when the server HTML must have them.

### Rendering links as buttons

Button has button semantics. The element of the `element` slot must be an element that can take button semantics (`role="button"` and the keys of a button). A link (`<a>`) has its own semantics. Do not render a link in the `element` slot of Button.

To make a link look like a button, style the `<a>` element with CSS. Do not use Button for this.

### Loading states

For a button that enters a loading state after activation, set `focusableWhenDisabled`. A button that has the focus keeps it while it is disabled.

Some browser and screen reader combinations do not reliably announce a change of the text in a focused button. Use [`aria-labelledby`](https://www.w3.org/TR/accname-1.2/#computation-steps) to make the changing text the explicit accessible name of the button.

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

### Styling the disabled state

A native disabled button matches `:disabled`. A disabled button with `focusableWhenDisabled`, and a disabled element of the `element` slot, have `aria-disabled="true"`. Select the disabled state with `:disabled` and `[aria-disabled='true']`. Select each other state with `:not(:disabled, [aria-disabled='true'])`, because `:enabled` also matches a `<button>` with `aria-disabled="true"`.

## API reference

<ApiReference />
