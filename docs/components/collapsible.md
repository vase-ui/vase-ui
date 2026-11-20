---
order: 1
description: An unstyled Vue collapsible component that displays a panel controlled by a button.
---

<script setup lang="ts">
import ApiReference from '../.vitepress/components/ApiReference.vue';
import DemoFrame from '../.vitepress/components/DemoFrame.vue';
import DemoSource from '../.vitepress/components/DemoSource.vue';
import DemoCollapsibleHero from '../demos/collapsible/hero/css-modules/index.vue';
import DemoCollapsibleHeroTailwind from '../demos/collapsible/hero/tailwind/index.vue';
</script>

# Collapsible

A collapsible panel controlled by a button.

<DemoFrame>
  <DemoCollapsibleHero />
  <template #tailwind>
    <DemoCollapsibleHeroTailwind />
  </template>
</DemoFrame>

<DemoSource variant="css-modules">

::: code-group

<<< ../demos/collapsible/hero/css-modules/index.vue

<<< ../demos/collapsible/hero/css-modules/index.module.css

:::

</DemoSource>

<DemoSource variant="tailwind">

::: code-group

<<< ../demos/collapsible/hero/tailwind/index.vue

:::

</DemoSource>

## Anatomy

Import the component and assemble its parts:

<<< ./collapsible/Anatomy.vue

## Examples

### Animate the panel

Put the panel in a `<Transition>`. The panel enters when it opens and leaves when it closes. Before each open and each close, the panel writes the size of its content in the CSS variables `--collapsible-panel-height` and `--collapsible-panel-width`. Use the height in the classes of the transition:

<<< ./collapsible/AnimatedPanel.vue{8,19-26}

At rest, the panel has the height of its content, so a change of the content while it is open needs no code. The panel reads the variables at its closed size. In a flex column, an item that can shrink then gives its shrunk size, so put a flex layout on a child of the panel. When the user opens the panel again during its leave, the new panel enters after the leave ends.

### Keep the panel mounted

With `keepMounted`, a closed panel stays in the DOM with `hidden` and `inert`. Its content keeps its state, and the server HTML has it. `<Transition>` does nothing for a kept panel, so animate it with CSS on `[hidden]`. This CSS needs one child element around the content:

<<< ./collapsible/KeptPanel.vue{8,15-26}

`inert` keeps the controls of a closed panel out of the focus order, also while the CSS shows its box. The two rules leave out a panel with `hiddenUntilFound`.

### Hidden until found

The `hiddenUntilFound` prop hides the closed panel with [`hidden="until-found"`](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Global_attributes/hidden). The find-in-page search of the browser (<kbd>Ctrl</kbd>+<kbd>F</kbd>, or <kbd>Cmd</kbd>+<kbd>F</kbd> on macOS) can then search its contents and open the panel when it finds a match. The closed panel always stays mounted in the DOM, so search engines can also index its contents.

<<< ./collapsible/HiddenUntilFound.vue{8}

- The feature is new in browsers. A browser that does not support `hidden="until-found"` keeps the panel hidden until its trigger opens it, and find-in-page skips the contents.
- The box of a closed panel keeps its padding and its border. Put them on a child element.
- Such a panel has no animation. A size transition at the open puts the found text out of the view, and the browser hides the content at once at a close. Do not give such a panel a `display` or a size transition.
- The server HTML has `hidden="until-found"` with Vue 3.5.41 or later, or 3.6.0-rc.3 or later. An earlier Vue writes `hidden`, and find-in-page then finds the panel only after its first close.

See the [Accordion example](/components/accordion#hidden-until-found) for an interactive demo.

### Render another element

`as` gives a part another tag or a component. To control the element, render it in the `element` slot, and bind `props` and `elementRef` on it. The slot wins over `as`.

<<< ./collapsible/OtherElement.vue{6,9-10}

## API reference

<ApiReference />
