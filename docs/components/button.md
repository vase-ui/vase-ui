---
order: 1
description: An unstyled Vue button component that can render as another tag and can stay focusable while it is disabled.
---

<script setup lang="ts">
import ApiReference from '../.vitepress/components/ApiReference.vue';
import DemoFrame from '../.vitepress/components/DemoFrame.vue';
import DemoButtonHero from '../demos/button/hero/css-modules/index.vue';
import DemoButtonLoading from '../demos/button/loading/css-modules/index.vue';
</script>

# Button

A button component that can render as another tag and can stay focusable while it is disabled.

<DemoFrame>
  <DemoButtonHero />
</DemoFrame>

::: code-group

<<< ../demos/button/hero/css-modules/index.vue

<<< ../demos/button/hero/css-modules/index.module.css

:::

## Usage guidelines

- **Submit buttons**: Unlike the native button element, Button renders `type="button"`. Set `type="submit"` for a submit button.
- **Links**: Button enforces button semantics (`role="button"`, keyboard interaction, disabled state). Do not use it for a link. See [Rendering links as buttons](#rendering-links-as-buttons).

## Anatomy

Import the component:

<<< ./button/Anatomy.vue

## Examples

### Rendering as another tag

Set `nativeButton` to `false` when the button renders as another tag, such as a `<div>`. The button then stays keyboard accessible.

<<< ./button/CustomTagButton.vue{6}

### Rendering links as buttons

Button enforces button semantics. `nativeButton` set to `false` says that the tag is not a `<button>`. The tag must still be a tag that can take button semantics (`role="button"` and keyboard interaction handlers). A link (`<a>`) has its own semantics. Do not render a link as a button through the `as` prop or the `#render` slot.

To make a link look like a button, style the `<a>` element with CSS. Do not use Button for this.

### Loading states

For a button that enters a loading state after activation, set `focusableWhenDisabled`. Focus then stays on the button while it is disabled.

Some browser and screen reader combinations do not reliably announce a change of the text in a focused button. Use [`aria-labelledby`](https://www.w3.org/TR/accname-1.2/#computation-steps) to make the changing text the explicit accessible name of the button.

<DemoFrame>
  <DemoButtonLoading />
</DemoFrame>

::: code-group

<<< ../demos/button/loading/css-modules/index.vue

<<< ../demos/button/loading/css-modules/index.module.css

:::

## API reference

<ApiReference />
